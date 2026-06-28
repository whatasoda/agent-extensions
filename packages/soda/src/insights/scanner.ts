import { createReadStream, readdirSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type {
  ArtifactCounts,
  BreakdownRow,
  HandoffEvidence,
  InsightsDataset,
  InsightsReport,
  SessionCohort,
  SessionInsight,
  TokenSummary,
  TokenUsage,
} from "./types.js";

interface ScanOptions {
  root: string;
  since: Date;
  until: Date;
}

interface SourceContext {
  actor: "root" | "subagent";
  agentId?: string;
  rootSessionId: string;
}

interface SessionMetadata {
  entrypoint?: string;
  firstTimestamp?: number;
  lastTimestamp?: number;
  promptSources: Set<string>;
  sessionKinds: Set<string>;
  handoffs: HandoffEvidence[];
}

interface ApiCandidate {
  actor: SourceContext["actor"];
  conflictFingerprint: string;
  hasIterations: boolean;
  model: string;
  occurrence: number;
  requestId: string;
  rootSessionId: string;
  stopReason: string | null;
  usage: TokenUsage;
}

interface ApiCallGroup {
  actorKinds: Set<SourceContext["actor"]>;
  candidates: ApiCandidate[];
  conflictFingerprints: Set<string>;
}

interface ToolCall {
  actor: SourceContext["actor"];
  agentType?: string;
  artifact?: "handoff_write" | "handoff_get" | "handoff_complete";
  handoff?: HandoffEvidence;
  name: string;
  rootSessionId: string;
  skill?: string;
}

interface MutableSessionStats {
  artifacts: ArtifactCounts;
  root: BreakdownRow;
  subagent: BreakdownRow;
}

const EMPTY_USAGE: TokenSummary = {
  input_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  output_tokens: 0,
  context_processed_tokens: 0,
};

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

function emptyBreakdown(): BreakdownRow {
  return { calls: 0, usage: { ...EMPTY_USAGE } };
}

function listJsonlFiles(root: string): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(entryPath);
      }
    }
  }

  visit(root);
  return files.sort();
}

function sourceContext(filePath: string): SourceContext {
  const parts = filePath.split(path.sep);
  const subagentsIndex = parts.lastIndexOf("subagents");
  if (subagentsIndex > 0) {
    const rootSessionId = parts[subagentsIndex - 1];
    const filename = parts.at(-1) ?? "";
    const agentId = filename.replace(/^agent-/, "").replace(/\.jsonl$/, "");
    return { actor: "subagent", agentId, rootSessionId };
  }

  return {
    actor: "root",
    rootSessionId: path.basename(filePath, ".jsonl"),
  };
}

function parseEntryTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  return {
    input_tokens: numberOrZero(usage.input_tokens),
    cache_creation_input_tokens: numberOrZero(usage.cache_creation_input_tokens),
    cache_read_input_tokens: numberOrZero(usage.cache_read_input_tokens),
    output_tokens: numberOrZero(usage.output_tokens),
  };
}

function usageFingerprint(model: string, requestId: string, usage: TokenUsage): string {
  return [
    model,
    requestId,
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens,
  ].join(":");
}

function isBetterCandidate(candidate: ApiCandidate, current: ApiCandidate): boolean {
  const candidateRank = [
    candidate.stopReason !== null ? 1 : 0,
    candidate.hasIterations ? 1 : 0,
    candidate.usage.output_tokens,
    candidate.occurrence,
  ];
  const currentRank = [
    current.stopReason !== null ? 1 : 0,
    current.hasIterations ? 1 : 0,
    current.usage.output_tokens,
    current.occurrence,
  ];

  for (let index = 0; index < candidateRank.length; index++) {
    if (candidateRank[index] !== currentRank[index]) {
      return candidateRank[index] > currentRank[index];
    }
  }
  return false;
}

function addUsage(target: TokenSummary, usage: TokenUsage): void {
  target.input_tokens += usage.input_tokens;
  target.cache_creation_input_tokens += usage.cache_creation_input_tokens;
  target.cache_read_input_tokens += usage.cache_read_input_tokens;
  target.output_tokens += usage.output_tokens;
  target.context_processed_tokens +=
    usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function incrementBreakdown(map: Map<string, BreakdownRow>, key: string, usage: TokenUsage): void {
  let row = map.get(key);
  if (!row) {
    row = { calls: 0, usage: { ...EMPTY_USAGE } };
    map.set(key, row);
  }
  row.calls++;
  addUsage(row.usage, usage);
}

function toSortedRecord<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function classifyCohort(metadata: SessionMetadata | undefined): SessionCohort {
  if (!metadata) return "unknown";

  const sources = metadata.promptSources;
  const kinds = metadata.sessionKinds;
  if (metadata.entrypoint === "sdk-cli" || sources.has("sdk") || sources.has("sdk-cli")) {
    return "sdk_automation";
  }
  if (
    sources.has("queued") ||
    sources.has("system") ||
    kinds.has("scheduled") ||
    kinds.has("queued")
  ) {
    return "scheduled_or_queued";
  }
  if (kinds.has("background") || kinds.has("bg")) {
    return "background";
  }
  if (sources.has("typed")) {
    return "human_interactive";
  }
  return "unknown";
}

function evidenceRefType(ref: string): HandoffEvidence["ref_type"] {
  return /^01[0-9A-HJKMNP-TV-Z]{24}$/.test(ref) ? "id" : "slug";
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function commandValue(command: string, pattern: RegExp): string | undefined {
  const match = command.match(pattern);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? unquote(value) : undefined;
}

function classifyHandoffCommand(
  command: unknown,
  timestamp: string,
): { artifact: ToolCall["artifact"]; evidence?: HandoffEvidence } | undefined {
  if (typeof command !== "string") return undefined;

  if (/\bsd\s+handoff\s+write\b/.test(command)) {
    const ref = commandValue(
      command,
      /\bsd\s+handoff\s+write\b[\s\S]*?--slug(?:=|\s+)("[^"]+"|'[^']+'|([^\s;&|\\]+))/,
    );
    return {
      artifact: "handoff_write",
      evidence: ref
        ? {
            action: "write",
            ref,
            ref_type: evidenceRefType(ref),
            source: "sd_command",
            timestamp,
          }
        : undefined,
    };
  }

  for (const [action, artifact] of [
    ["get", "handoff_get"],
    ["complete", "handoff_complete"],
  ] as const) {
    const ref = commandValue(
      command,
      new RegExp(`\\bsd\\s+handoff\\s+${action}\\s+("[^"]+"|'[^']+'|([^\\s;&|\\\\]+))`),
    );
    if (ref) {
      return {
        artifact,
        evidence: {
          action,
          ref,
          ref_type: evidenceRefType(ref),
          source: "sd_command",
          timestamp,
        },
      };
    }
  }
  return undefined;
}

function handoffPathEvidence(
  value: unknown,
  source: "user_path" | "read_path",
  timestamp: string,
): HandoffEvidence[] {
  if (typeof value !== "string") return [];
  const evidence: HandoffEvidence[] = [];
  const pattern = /(?:^|[/\\])handoffs[/\\](01[0-9A-HJKMNP-TV-Z]{24})\.md\b/g;
  for (const match of value.matchAll(pattern)) {
    evidence.push({
      action: "reference",
      ref: match[1],
      ref_type: "id",
      source,
      timestamp,
    });
  }
  return evidence;
}

function userTextValues(message: Record<string, unknown> | undefined): string[] {
  if (!message) return [];
  if (typeof message.content === "string") return [message.content];
  if (!Array.isArray(message.content)) return [];
  return message.content.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const block = item as Record<string, unknown>;
    return block.type === "text" && typeof block.text === "string" ? [block.text] : [];
  });
}

function countGitOperation(operation: unknown, artifacts: ArtifactCounts): void {
  if (!operation || typeof operation !== "object") return;
  const record = operation as Record<string, unknown>;
  const operationName =
    typeof record.type === "string"
      ? record.type
      : typeof record.operation === "string"
        ? record.operation
        : "";
  const keys = new Set(Object.keys(record));

  if (operationName === "commit" || keys.has("commit")) artifacts.git_commit++;
  if (operationName === "push" || keys.has("push")) artifacts.git_push++;
  if (
    operationName === "pr" ||
    operationName === "pull_request" ||
    keys.has("pr") ||
    keys.has("pullRequest")
  ) {
    artifacts.git_pr++;
  }
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

function pushHandoffEvidence(metadata: SessionMetadata, evidence: HandoffEvidence): void {
  const duplicate = metadata.handoffs.some(
    (item) =>
      item.action === evidence.action &&
      item.ref === evidence.ref &&
      item.source === evidence.source &&
      item.timestamp === evidence.timestamp,
  );
  if (!duplicate) metadata.handoffs.push(evidence);
}

function mutableSessionStats(
  stats: Map<string, MutableSessionStats>,
  sessionId: string,
): MutableSessionStats {
  let value = stats.get(sessionId);
  if (!value) {
    value = {
      artifacts: emptyArtifacts(),
      root: emptyBreakdown(),
      subagent: emptyBreakdown(),
    };
    stats.set(sessionId, value);
  }
  return value;
}

export async function scanInsightsDataset(options: ScanOptions): Promise<InsightsDataset> {
  const since = options.since.getTime();
  const until = options.until.getTime();
  if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until) {
    throw new Error("Invalid insights period");
  }

  const files = listJsonlFiles(options.root);
  const apiGroups = new Map<string, ApiCallGroup>();
  const toolCalls = new Map<string, ToolCall>();
  const sessions = new Map<string, SessionMetadata>();
  const periodSessions = new Set<string>();
  const periodFiles = new Set<string>();
  const prLinks = new Set<string>();
  const prLinksBySession = new Map<string, Set<string>>();
  const gitOperations = new Set<string>();
  const artifacts = emptyArtifacts();
  const sessionStats = new Map<string, MutableSessionStats>();
  let malformedLines = 0;
  let occurrence = 0;

  for (const file of files) {
    const source = sourceContext(file);
    let metadata = sessions.get(source.rootSessionId);
    if (!metadata) {
      metadata = { handoffs: [], promptSources: new Set(), sessionKinds: new Set() };
      sessions.set(source.rootSessionId, metadata);
    }

    const lines = createInterface({
      crlfDelay: Infinity,
      input: createReadStream(file, { encoding: "utf8" }),
    });

    for await (const line of lines) {
      if (!line.trim()) continue;
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line) as Record<string, unknown>;
      } catch {
        malformedLines++;
        continue;
      }

      if (typeof entry.entrypoint === "string") {
        metadata.entrypoint = entry.entrypoint;
      }
      if (typeof entry.promptSource === "string") {
        metadata.promptSources.add(entry.promptSource);
      }
      if (typeof entry.sessionKind === "string") {
        metadata.sessionKinds.add(entry.sessionKind);
      }

      const timestamp = parseEntryTimestamp(entry.timestamp);
      if (timestamp === null || timestamp < since || timestamp >= until) {
        continue;
      }
      periodFiles.add(file);
      periodSessions.add(source.rootSessionId);
      metadata.firstTimestamp = Math.min(metadata.firstTimestamp ?? timestamp, timestamp);
      metadata.lastTimestamp = Math.max(metadata.lastTimestamp ?? timestamp, timestamp);

      const entryType = typeof entry.type === "string" ? entry.type : "";
      const message =
        entry.message && typeof entry.message === "object"
          ? (entry.message as Record<string, unknown>)
          : undefined;

      if (entryType === "assistant" && message) {
        const usage = readUsage(message.usage);
        if (usage) {
          const messageId =
            typeof message.id === "string"
              ? message.id
              : typeof entry.requestId === "string"
                ? entry.requestId
                : `${file}:${entry.uuid ?? occurrence}`;
          const model = typeof message.model === "string" ? message.model : "unknown";
          const requestId = typeof entry.requestId === "string" ? entry.requestId : "unknown";
          const candidate: ApiCandidate = {
            actor: source.actor,
            conflictFingerprint: usageFingerprint(model, requestId, usage),
            hasIterations:
              !!message.usage &&
              typeof message.usage === "object" &&
              Array.isArray((message.usage as Record<string, unknown>).iterations),
            model,
            occurrence: occurrence++,
            requestId,
            rootSessionId: source.rootSessionId,
            stopReason: typeof message.stop_reason === "string" ? message.stop_reason : null,
            usage,
          };

          let group = apiGroups.get(messageId);
          if (!group) {
            group = {
              actorKinds: new Set(),
              candidates: [],
              conflictFingerprints: new Set(),
            };
            apiGroups.set(messageId, group);
          }
          group.actorKinds.add(source.actor);
          group.candidates.push(candidate);
          group.conflictFingerprints.add(candidate.conflictFingerprint);
        }

        const content = Array.isArray(message.content) ? message.content : [];
        for (const item of content) {
          if (!item || typeof item !== "object") continue;
          const block = item as Record<string, unknown>;
          if (block.type !== "tool_use" || typeof block.id !== "string") continue;
          const input =
            block.input && typeof block.input === "object"
              ? (block.input as Record<string, unknown>)
              : {};
          const name = typeof block.name === "string" ? block.name : "unknown";
          const toolCall: ToolCall = {
            actor: source.actor,
            name,
            rootSessionId: source.rootSessionId,
          };
          if (name === "Skill" && typeof input.skill === "string") {
            toolCall.skill = input.skill;
          }
          if ((name === "Agent" || name === "Task") && typeof input.subagent_type === "string") {
            toolCall.agentType = input.subagent_type;
          }
          if (name === "Bash") {
            const handoff = classifyHandoffCommand(
              input.command,
              new Date(timestamp).toISOString(),
            );
            toolCall.artifact = handoff?.artifact;
            toolCall.handoff = handoff?.evidence;
          }
          if (name === "Read") {
            const [handoff] = handoffPathEvidence(
              input.file_path,
              "read_path",
              new Date(timestamp).toISOString(),
            );
            toolCall.handoff = handoff;
          }

          const existing = toolCalls.get(block.id);
          if (!existing || (existing.actor === "subagent" && source.actor === "root")) {
            toolCalls.set(block.id, toolCall);
          }
        }
      }

      if (entryType === "user") {
        for (const value of userTextValues(message)) {
          for (const evidence of handoffPathEvidence(
            value,
            "user_path",
            new Date(timestamp).toISOString(),
          )) {
            pushHandoffEvidence(metadata, evidence);
          }
        }
      }

      if (entryType === "pr-link") {
        const key =
          typeof entry.prUrl === "string"
            ? entry.prUrl
            : `${source.rootSessionId}:${entry.prRepository ?? ""}:${entry.prNumber ?? ""}`;
        prLinks.add(key);
        let sessionLinks = prLinksBySession.get(source.rootSessionId);
        if (!sessionLinks) {
          sessionLinks = new Set();
          prLinksBySession.set(source.rootSessionId, sessionLinks);
        }
        sessionLinks.add(key);
      }

      const toolUseResult =
        entry.toolUseResult && typeof entry.toolUseResult === "object"
          ? (entry.toolUseResult as Record<string, unknown>)
          : undefined;
      if (toolUseResult?.gitOperation) {
        const operationId =
          typeof entry.toolUseID === "string"
            ? entry.toolUseID
            : typeof entry.sourceToolUseID === "string"
              ? entry.sourceToolUseID
              : typeof entry.uuid === "string"
                ? entry.uuid
                : `${file}:${occurrence++}`;
        if (!gitOperations.has(operationId)) {
          gitOperations.add(operationId);
          countGitOperation(toolUseResult.gitOperation, artifacts);
          countGitOperation(
            toolUseResult.gitOperation,
            mutableSessionStats(sessionStats, source.rootSessionId).artifacts,
          );
        }
      }
    }
  }

  const cohortBySession = new Map<string, SessionCohort>();
  const sessionCounts = new Map<string, number>();
  for (const sessionId of periodSessions) {
    const cohort = classifyCohort(sessions.get(sessionId));
    cohortBySession.set(sessionId, cohort);
    increment(sessionCounts, cohort);
  }

  const totalUsage: TokenSummary = { ...EMPTY_USAGE };
  const byModel = new Map<string, BreakdownRow>();
  const byActor = new Map<string, BreakdownRow>();
  const byCohort = new Map<string, BreakdownRow>();
  const contexts: number[] = [];
  let conflictingCalls = 0;
  let ambiguousActorCalls = 0;
  let uniqueCalls = 0;

  for (const group of apiGroups.values()) {
    if (group.conflictFingerprints.size > 1) {
      conflictingCalls++;
      continue;
    }
    let selected = group.candidates[0];
    for (const candidate of group.candidates.slice(1)) {
      if (isBetterCandidate(candidate, selected)) selected = candidate;
    }
    const actor = group.actorKinds.has("root") ? "root" : selected.actor;
    if (group.actorKinds.size > 1) ambiguousActorCalls++;
    const cohort = cohortBySession.get(selected.rootSessionId) ?? "unknown";

    uniqueCalls++;
    addUsage(totalUsage, selected.usage);
    incrementBreakdown(byModel, selected.model, selected.usage);
    incrementBreakdown(byActor, actor, selected.usage);
    incrementBreakdown(byCohort, cohort, selected.usage);
    const session = mutableSessionStats(sessionStats, selected.rootSessionId);
    const actorBreakdown = actor === "root" ? session.root : session.subagent;
    actorBreakdown.calls++;
    addUsage(actorBreakdown.usage, selected.usage);
    contexts.push(
      selected.usage.input_tokens +
        selected.usage.cache_creation_input_tokens +
        selected.usage.cache_read_input_tokens,
    );
  }
  contexts.sort((left, right) => left - right);

  const toolNames = new Map<string, number>();
  const skills = new Map<string, number>();
  const agentLaunches = new Map<string, number>();
  for (const toolCall of toolCalls.values()) {
    increment(toolNames, toolCall.name);
    if (toolCall.skill) increment(skills, toolCall.skill);
    if (toolCall.agentType) increment(agentLaunches, toolCall.agentType);
    if (toolCall.artifact) {
      artifacts[toolCall.artifact]++;
      mutableSessionStats(sessionStats, toolCall.rootSessionId).artifacts[toolCall.artifact]++;
    }
    if (toolCall.handoff) {
      const metadata = sessions.get(toolCall.rootSessionId);
      if (metadata) pushHandoffEvidence(metadata, toolCall.handoff);
    }
  }
  artifacts.pr_links = prLinks.size;
  for (const [sessionId, links] of prLinksBySession) {
    mutableSessionStats(sessionStats, sessionId).artifacts.pr_links = links.size;
  }

  const report: InsightsReport = {
    schema_version: 1,
    period: {
      since: options.since.toISOString(),
      until: options.until.toISOString(),
    },
    source: {
      files_scanned: files.length,
      files_with_period_entries: periodFiles.size,
      malformed_lines: malformedLines,
    },
    sessions: {
      total: periodSessions.size,
      by_cohort: toSortedRecord(sessionCounts),
    },
    api: {
      unique_calls: uniqueCalls,
      conflicting_calls: conflictingCalls,
      ambiguous_actor_calls: ambiguousActorCalls,
      usage: totalUsage,
      context_per_call: {
        p50: percentile(contexts, 0.5),
        p90: percentile(contexts, 0.9),
        p99: percentile(contexts, 0.99),
      },
      by_model: toSortedRecord(byModel),
      by_actor: toSortedRecord(byActor),
      by_cohort: toSortedRecord(byCohort),
    },
    tools: {
      unique_calls: toolCalls.size,
      by_name: toSortedRecord(toolNames),
      skills: toSortedRecord(skills),
      agent_launches: toSortedRecord(agentLaunches),
    },
    artifacts,
    privacy: {
      raw_content_retained: false,
      command_text_retained: false,
    },
  };

  const sessionDetails: SessionInsight[] = [...periodSessions].sort().map((sessionId) => {
    const metadata = sessions.get(sessionId);
    const stats = mutableSessionStats(sessionStats, sessionId);
    const total: TokenSummary = { ...EMPTY_USAGE };
    addUsage(total, stats.root.usage);
    addUsage(total, stats.subagent.usage);
    return {
      session_id: sessionId,
      cohort: cohortBySession.get(sessionId) ?? "unknown",
      first_timestamp: new Date(metadata?.firstTimestamp ?? since).toISOString(),
      last_timestamp: new Date(metadata?.lastTimestamp ?? since).toISOString(),
      api: {
        calls: stats.root.calls + stats.subagent.calls,
        root: stats.root,
        subagent: stats.subagent,
        total,
      },
      handoffs: [...(metadata?.handoffs ?? [])].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp),
      ),
      artifacts: stats.artifacts,
    };
  });

  return { report, sessions: sessionDetails };
}

export async function scanInsights(options: ScanOptions): Promise<InsightsReport> {
  return (await scanInsightsDataset(options)).report;
}
