import { Database } from "bun:sqlite";
import type {
  ArtifactCounts,
  BreakdownRow,
  InsightsDataset,
  SessionInsight,
  TokenSummary,
} from "./types.js";

interface HandoffRow {
  id: string;
  properties: string;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  node_id: string;
  tag: string;
}

interface LinkRow {
  from_id: string;
  to_id: string;
  link_type: string;
}

interface HandoffNode {
  id: string;
  slug: string;
  status: string;
  repo: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface ConfirmedEdge {
  from: string;
  to: string;
  type: string;
  source: "knowledge_graph" | "session_transition";
  session_id?: string;
}

export interface WorkstreamSummary {
  workstream_id: string;
  handoff_count: number;
  session_count: number;
  shared_session_count: number;
  status_counts: Record<string, number>;
  repos: string[];
  first_created_at: string;
  last_updated_at: string;
  api: {
    calls: number;
    root: BreakdownRow;
    subagent: BreakdownRow;
    total: TokenSummary;
    subagent_context_share_pct: number;
  };
  artifacts: ArtifactCounts;
  evidence: {
    knowledge_graph_links: number;
    session_transitions: number;
  };
  latest_handoffs: Array<{
    id: string;
    slug: string;
    status: string;
    updated_at: string;
  }>;
}

export interface WorkstreamReport {
  schema_version: 1;
  period: InsightsDataset["report"]["period"];
  summary: {
    confirmed_workstreams: number;
    returned_workstreams: number;
    connected_handoffs: number;
    linked_sessions: number;
    multi_workstream_sessions: number;
    unresolved_handoff_refs: number;
  };
  workstreams: WorkstreamSummary[];
  candidate_topic_groups: Array<{
    tag: string;
    handoff_count: number;
    confirmed_component_count: number;
  }>;
  policy: {
    confirmed_edges: string[];
    candidate_only: string[];
    excluded_evidence: string[];
  };
}

const CONFIRMED_LINK_TYPES = new Set([
  "continues",
  "follows-up",
  "follows_up",
  "extends",
  "refines",
  "supersedes",
  "superseded_by",
]);

const EMPTY_USAGE: TokenSummary = {
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
  context_processed_tokens: 0,
};

function emptyBreakdown(): BreakdownRow {
  return { calls: 0, usage: { ...EMPTY_USAGE } };
}

function emptyArtifacts(): ArtifactCounts {
  return {
    git_commit: 0,
    git_pr: 0,
    git_push: 0,
    handoff_complete: 0,
    handoff_get: 0,
    handoff_write: 0,
    pr_links: 0,
  };
}

function addUsage(target: TokenSummary, source: TokenSummary): void {
  target.input_tokens += source.input_tokens;
  target.cache_creation_input_tokens += source.cache_creation_input_tokens;
  target.cache_read_input_tokens += source.cache_read_input_tokens;
  target.output_tokens += source.output_tokens;
  target.context_processed_tokens += source.context_processed_tokens;
}

function addBreakdown(target: BreakdownRow, source: BreakdownRow): void {
  target.calls += source.calls;
  addUsage(target.usage, source.usage);
}

function addArtifacts(target: ArtifactCounts, source: ArtifactCounts): void {
  for (const key of Object.keys(target) as Array<keyof ArtifactCounts>) {
    target[key] += source[key];
  }
}

class UnionFind {
  private readonly parents = new Map<string, string>();

  add(value: string): void {
    if (!this.parents.has(value)) this.parents.set(value, value);
  }

  find(value: string): string {
    const parent = this.parents.get(value);
    if (!parent) {
      this.add(value);
      return value;
    }
    if (parent === value) return value;
    const root = this.find(parent);
    this.parents.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    const [first, second] = [leftRoot, rightRoot].sort();
    this.parents.set(second, first);
  }
}

function readKnowledgeGraph(dbPath: string): {
  handoffs: HandoffNode[];
  links: LinkRow[];
} {
  const db = new Database(dbPath, { readonly: true, strict: true });
  try {
    const rows = db
      .query<HandoffRow, []>(
        "SELECT id, properties, created_at, updated_at FROM nodes WHERE kind = 'handoff'",
      )
      .all();
    const tags = db
      .query<TagRow, []>(
        "SELECT t.node_id, t.tag FROM tags t JOIN nodes n ON n.id = t.node_id WHERE n.kind = 'handoff'",
      )
      .all();
    const links = db
      .query<LinkRow, []>(
        `SELECT l.from_id, l.to_id, l.link_type
         FROM links l
         JOIN nodes source ON source.id = l.from_id
         JOIN nodes target ON target.id = l.to_id
         WHERE source.kind = 'handoff' AND target.kind = 'handoff'`,
      )
      .all();

    const tagsByNode = new Map<string, string[]>();
    for (const tag of tags) {
      const values = tagsByNode.get(tag.node_id) ?? [];
      values.push(tag.tag);
      tagsByNode.set(tag.node_id, values);
    }

    return {
      handoffs: rows.map((row) => {
        const properties = JSON.parse(row.properties) as Record<string, unknown>;
        const owner = typeof properties.repo_owner === "string" ? properties.repo_owner : "";
        const name = typeof properties.repo_name === "string" ? properties.repo_name : "";
        return {
          id: row.id,
          slug: typeof properties.slug === "string" ? properties.slug : row.id,
          status: typeof properties.status === "string" ? properties.status : "unknown",
          repo: owner && name ? `${owner}/${name}` : "",
          tags: (tagsByNode.get(row.id) ?? []).sort(),
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }),
      links,
    };
  } finally {
    db.close();
  }
}

function resolveHandoffRef(
  ref: string,
  byId: Map<string, HandoffNode>,
  bySlug: Map<string, HandoffNode>,
): HandoffNode | undefined {
  return byId.get(ref) ?? bySlug.get(ref);
}

function sessionTransitions(
  sessions: SessionInsight[],
  byId: Map<string, HandoffNode>,
  bySlug: Map<string, HandoffNode>,
): { edges: ConfirmedEdge[]; unresolved: number } {
  const edges: ConfirmedEdge[] = [];
  const edgeKeys = new Set<string>();
  let unresolved = 0;

  for (const session of sessions) {
    const resolved = session.handoffs
      .map((evidence) => ({
        evidence,
        handoff: resolveHandoffRef(evidence.ref, byId, bySlug),
      }))
      .sort((left, right) => left.evidence.timestamp.localeCompare(right.evidence.timestamp));
    for (const { handoff } of resolved) {
      if (!handoff) {
        unresolved++;
      }
    }

    for (const current of resolved) {
      if (current.evidence.action !== "write" || !current.handoff) continue;
      const priorInputs = resolved.filter(
        (candidate) =>
          !!candidate.handoff &&
          (candidate.evidence.action === "reference" || candidate.evidence.action === "get") &&
          candidate.evidence.timestamp <= current.evidence.timestamp,
      );
      const latestTimestamp = priorInputs.at(-1)?.evidence.timestamp;
      if (!latestTimestamp) continue;

      for (const prior of priorInputs.filter(
        (candidate) => candidate.evidence.timestamp === latestTimestamp,
      )) {
        const from = prior.handoff!.id;
        const to = current.handoff.id;
        if (from === to) continue;
        const key = `${from}:${to}:${session.session_id}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edges.push({
          from,
          to,
          type: "continues_in_session",
          source: "session_transition",
          session_id: session.session_id,
        });
      }
    }
  }
  return { edges, unresolved };
}

function incrementRecord(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function resolveWorkstreams(
  dataset: InsightsDataset,
  dbPath: string,
  minimumHandoffs = 2,
): WorkstreamReport {
  const snapshot = readKnowledgeGraph(dbPath);
  const byId = new Map(snapshot.handoffs.map((handoff) => [handoff.id, handoff]));
  const bySlug = new Map(snapshot.handoffs.map((handoff) => [handoff.slug, handoff]));
  const unionFind = new UnionFind();
  for (const handoff of snapshot.handoffs) unionFind.add(handoff.id);

  const edges: ConfirmedEdge[] = [];
  for (const link of snapshot.links) {
    if (!CONFIRMED_LINK_TYPES.has(link.link_type)) continue;
    unionFind.union(link.from_id, link.to_id);
    edges.push({
      from: link.from_id,
      to: link.to_id,
      type: link.link_type,
      source: "knowledge_graph",
    });
  }

  const transitions = sessionTransitions(dataset.sessions, byId, bySlug);
  for (const edge of transitions.edges) {
    unionFind.union(edge.from, edge.to);
    edges.push(edge);
  }

  const componentByHandoff = new Map<string, string>();
  const handoffsByComponent = new Map<string, HandoffNode[]>();
  for (const handoff of snapshot.handoffs) {
    const component = unionFind.find(handoff.id);
    componentByHandoff.set(handoff.id, component);
    const values = handoffsByComponent.get(component) ?? [];
    values.push(handoff);
    handoffsByComponent.set(component, values);
  }

  const sessionsByComponent = new Map<string, SessionInsight[]>();
  const componentsBySession = new Map<string, Set<string>>();
  for (const session of dataset.sessions) {
    const components = new Set<string>();
    for (const evidence of session.handoffs) {
      const handoff = resolveHandoffRef(evidence.ref, byId, bySlug);
      if (handoff) components.add(componentByHandoff.get(handoff.id) ?? handoff.id);
    }
    componentsBySession.set(session.session_id, components);
    for (const component of components) {
      const values = sessionsByComponent.get(component) ?? [];
      values.push(session);
      sessionsByComponent.set(component, values);
    }
  }

  const edgeCountsByComponent = new Map<
    string,
    { knowledge_graph_links: number; session_transitions: number }
  >();
  for (const edge of edges) {
    const component = componentByHandoff.get(edge.from);
    if (!component) continue;
    const counts = edgeCountsByComponent.get(component) ?? {
      knowledge_graph_links: 0,
      session_transitions: 0,
    };
    if (edge.source === "knowledge_graph") counts.knowledge_graph_links++;
    else counts.session_transitions++;
    edgeCountsByComponent.set(component, counts);
  }

  const workstreams: WorkstreamSummary[] = [];
  for (const [component, handoffs] of handoffsByComponent) {
    if (handoffs.length < minimumHandoffs) continue;
    const sessions = sessionsByComponent.get(component) ?? [];
    if (sessions.length === 0) continue;

    const root = emptyBreakdown();
    const subagent = emptyBreakdown();
    const total: TokenSummary = { ...EMPTY_USAGE };
    const artifacts = emptyArtifacts();
    for (const session of sessions) {
      addBreakdown(root, session.api.root);
      addBreakdown(subagent, session.api.subagent);
      addUsage(total, session.api.total);
      addArtifacts(artifacts, session.artifacts);
    }

    const sortedHandoffs = [...handoffs].sort((left, right) =>
      left.created_at.localeCompare(right.created_at),
    );
    const statusCounts: Record<string, number> = {};
    for (const handoff of handoffs) incrementRecord(statusCounts, handoff.status);
    const repos = [...new Set(handoffs.map((handoff) => handoff.repo).filter(Boolean))].sort();
    const subagentShare =
      total.context_processed_tokens > 0
        ? (subagent.usage.context_processed_tokens / total.context_processed_tokens) * 100
        : 0;

    workstreams.push({
      workstream_id: `ws-${sortedHandoffs[0].id}`,
      handoff_count: handoffs.length,
      session_count: sessions.length,
      shared_session_count: sessions.filter(
        (session) => (componentsBySession.get(session.session_id)?.size ?? 0) > 1,
      ).length,
      status_counts: statusCounts,
      repos,
      first_created_at: sortedHandoffs[0].created_at,
      last_updated_at: handoffs.reduce(
        (latest, handoff) => (handoff.updated_at > latest ? handoff.updated_at : latest),
        handoffs[0].updated_at,
      ),
      api: {
        calls: root.calls + subagent.calls,
        root,
        subagent,
        total,
        subagent_context_share_pct: Math.round(subagentShare * 10) / 10,
      },
      artifacts,
      evidence: edgeCountsByComponent.get(component) ?? {
        knowledge_graph_links: 0,
        session_transitions: 0,
      },
      latest_handoffs: [...handoffs]
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .slice(0, 5)
        .map((handoff) => ({
          id: handoff.id,
          slug: handoff.slug,
          status: handoff.status,
          updated_at: handoff.updated_at,
        })),
    });
  }
  workstreams.sort(
    (left, right) =>
      right.api.total.context_processed_tokens - left.api.total.context_processed_tokens,
  );

  const tagGroups = new Map<string, HandoffNode[]>();
  for (const handoff of snapshot.handoffs) {
    for (const tag of handoff.tags.filter((value) => value.startsWith("topic:"))) {
      const values = tagGroups.get(tag) ?? [];
      values.push(handoff);
      tagGroups.set(tag, values);
    }
  }
  const candidateTopicGroups = [...tagGroups]
    .filter(([, handoffs]) => handoffs.length >= minimumHandoffs)
    .map(([tag, handoffs]) => ({
      tag,
      handoff_count: handoffs.length,
      confirmed_component_count: new Set(
        handoffs.map((handoff) => componentByHandoff.get(handoff.id)),
      ).size,
    }))
    .filter((group) => group.confirmed_component_count > 1)
    .sort(
      (left, right) =>
        right.handoff_count - left.handoff_count || left.tag.localeCompare(right.tag),
    )
    .slice(0, 25);

  return {
    schema_version: 1,
    period: dataset.report.period,
    summary: {
      confirmed_workstreams: workstreams.length,
      returned_workstreams: workstreams.length,
      connected_handoffs: workstreams.reduce(
        (sum, workstream) => sum + workstream.handoff_count,
        0,
      ),
      linked_sessions: new Set(
        [...sessionsByComponent.values()].flatMap((sessions) =>
          sessions.map((session) => session.session_id),
        ),
      ).size,
      multi_workstream_sessions: [...componentsBySession.values()].filter(
        (components) => components.size > 1,
      ).length,
      unresolved_handoff_refs: transitions.unresolved,
    },
    workstreams,
    candidate_topic_groups: candidateTopicGroups,
    policy: {
      confirmed_edges: [
        "allowlisted handoff-to-handoff knowledge graph links",
        "a session explicitly references/gets handoff A and writes handoff B",
      ],
      candidate_only: ["shared topic tags"],
      excluded_evidence: [
        "sd handoff list output",
        "sd node/decision search output",
        "assistant prose substring matches",
        "repo, branch, or filename similarity alone",
      ],
    },
  };
}
