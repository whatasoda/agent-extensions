import { mkdirSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import type { Database } from "../../core/database.js";
import { exitWithError, outputJson, parseCli } from "../helpers.js";

// Resolved so every path this command reports is absolute, whatever SODA_AGENT_TOOLS_HANDOFF_DIR
// holds: callers act on these paths from a different cwd than the one that produced them.
const HANDOFF_DIR = path.resolve(
  process.env.SODA_AGENT_TOOLS_HANDOFF_DIR ??
    path.join(os.homedir(), ".soda-agent-tools", "handoffs"),
);

export async function handleHandoff(db: Database, args: string[]): Promise<void> {
  const [action] = args;
  const rest = args.slice(1);

  switch (action) {
    case "generate":
      return handoffGenerate(db, rest);
    case "write":
      return handoffWrite(db, rest);
    case "list":
      return handoffList(db, rest);
    case "get":
      return handoffGet(db, rest);
    case "complete":
      return handoffComplete(db, rest);
    default:
      exitWithError("Usage: sd handoff <generate|write|list|get|complete>");
  }
}

function resolveByIdOrSlug(db: Database, idOrSlug: string) {
  const byId = db.getNode(idOrSlug);
  if (byId) return byId;

  const results = db.search({ kind: "handoff", limit: 1000, offset: 0 });
  const bySlug = results.nodes.find((n) => {
    const props = n.properties as Record<string, unknown> | undefined;
    return props?.slug === idOrSlug;
  });
  return bySlug ?? null;
}

function exportFile(nodeId: string, body: string): string {
  mkdirSync(HANDOFF_DIR, { recursive: true });
  const filePath = path.join(HANDOFF_DIR, `${nodeId}.md`);
  writeFileSync(filePath, body);
  return filePath;
}

interface UpsertInput {
  slug: string;
  body: string;
  extraProperties?: Record<string, unknown>;
  tags?: string[];
}

function upsertHandoff(db: Database, input: UpsertInput) {
  const properties: Record<string, unknown> = {
    status: "active",
    slug: input.slug,
    ...input.extraProperties,
  };

  // Upsert: find existing active handoff with same slug
  const existing = db.search({ kind: "handoff", limit: 1000, offset: 0 });
  const match = existing.nodes.find((n) => {
    const props = n.properties as Record<string, unknown> | undefined;
    return props?.slug === input.slug && props?.status === "active";
  });

  if (!match) {
    const created = db.createNode({
      kind: "handoff",
      body: input.body,
      properties,
      tags: input.tags,
    });
    return { result: created, filePath: exportFile(created.id, input.body) };
  }

  const result = db.updateNode({
    id: match.id,
    body: input.body,
    properties: { ...(match.properties as Record<string, unknown>), ...properties },
  });
  // updateNode ignores tags, so an updated handoff would otherwise keep only the tags it was
  // created with — new tags derived from the current session would silently be dropped.
  if (input.tags?.length) db.addTags(match.id, input.tags);

  return { result, filePath: exportFile(result.id, input.body) };
}

function parseOutputMode(value: unknown): "full" | "compact" {
  if (value !== "full" && value !== "compact") {
    exitWithError("Error: --output must be either full or compact");
  }
  return value;
}

async function handoffWrite(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    slug: { type: "string" },
    "repo-owner": { type: "string" },
    "repo-name": { type: "string" },
    tags: { type: "string" },
    stdin: { default: false, type: "boolean" },
    output: { type: "string", default: "full" },
  });

  const slug = values.slug as string | undefined;
  if (!slug) exitWithError("Error: --slug is required");
  const outputMode = parseOutputMode(values.output);

  // Read raw Markdown from stdin (NOT JSON)
  const body = (await Bun.stdin.text()).trimEnd();
  if (!body) exitWithError("Error: no input received on stdin");

  const extraProperties: Record<string, unknown> = {};
  if (values["repo-owner"]) extraProperties.repo_owner = values["repo-owner"];
  if (values["repo-name"]) extraProperties.repo_name = values["repo-name"];

  const { result, filePath } = upsertHandoff(db, {
    slug,
    body,
    extraProperties,
    tags: (values.tags as string | undefined)?.split(","),
  });

  if (outputMode === "compact") {
    outputJson({
      id: result.id,
      slug,
      status: "active",
      updated_at: result.updated_at,
      file_path: filePath,
    });
    return;
  }
  outputJson({ ...result, file_path: filePath });
}

async function handoffGenerate(db: Database, args: string[]): Promise<void> {
  const { values, positionals } = parseCli(args, {
    slug: { type: "string" },
    scope: { type: "string" },
    model: { type: "string", default: "gpt-5.4" },
    tags: { type: "string" },
    "repo-owner": { type: "string" },
    "repo-name": { type: "string" },
    transcript: { type: "string" },
    "session-id": { type: "string" },
    "claude-config-dir": { type: "string" },
    "from-turn": { type: "string" },
    "to-turn": { type: "string" },
    "allow-latest-fallback": { default: false, type: "boolean" },
    "max-transcript-chars": { type: "string", default: "300000" },
    "timeout-seconds": { type: "string", default: "1800" },
    "review-rounds": { type: "string", default: "2" },
    "dry-run": { default: false, type: "boolean" },
    output: { type: "string", default: "compact" },
  });

  const outputMode = parseOutputMode(values.output);

  const parseNumber = (flag: string, raw: unknown, min = 1): number | undefined => {
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min) {
      exitWithError(`Error: --${flag} must be a number >= ${min}`);
    }
    return parsed;
  };

  const scope = (values.scope as string | undefined) ?? (positionals.join(" ").trim() || undefined);

  const { generateHandoff, HandoffGenerationError, sanitizeTag } =
    await import("../../handoff/generate.js");

  let generated;
  try {
    generated = await generateHandoff({
      cwd: process.cwd(),
      scope,
      slug: values.slug as string | undefined,
      model: values.model as string,
      transcriptPath: values.transcript as string | undefined,
      sessionId: values["session-id"] as string | undefined,
      claudeConfigDir: values["claude-config-dir"] as string | undefined,
      fromTurn: parseNumber("from-turn", values["from-turn"]),
      toTurn: parseNumber("to-turn", values["to-turn"]),
      allowLatestFallback: values["allow-latest-fallback"] as boolean,
      maxTranscriptChars: parseNumber("max-transcript-chars", values["max-transcript-chars"])!,
      timeoutSeconds: parseNumber("timeout-seconds", values["timeout-seconds"])!,
      reviewRounds: parseNumber("review-rounds", values["review-rounds"], 0)!,
      dryRun: values["dry-run"] as boolean,
    });
  } catch (error) {
    if (error instanceof HandoffGenerationError) exitWithError(`Error: ${error.message}`);
    throw error;
  }

  if (!generated.draft || !generated.body || !generated.slug) {
    outputJson({
      dry_run: true,
      slug: generated.slug,
      model: generated.model,
      artifacts_dir: generated.artifacts_dir,
      prompt_path: generated.prompt_path,
      transcript: generated.transcript,
      repo: generated.repo,
    });
    return;
  }

  const repoOwner = (values["repo-owner"] as string | undefined) ?? generated.repo?.owner;
  const repoName = (values["repo-name"] as string | undefined) ?? generated.repo?.name;

  const tags = [
    `topic:${generated.slug}`,
    ...generated.draft.tags,
    ...((values.tags as string | undefined)?.split(",") ?? []),
  ]
    .map(sanitizeTag)
    .filter((tag): tag is string => tag !== null);

  const extraProperties: Record<string, unknown> = {
    generated_by: "codex",
    model: generated.model,
    keywords_en: generated.draft.keywords_en,
  };
  if (repoOwner) extraProperties.repo_owner = repoOwner;
  if (repoName) extraProperties.repo_name = repoName;

  const { result, filePath } = upsertHandoff(db, {
    slug: generated.slug,
    body: generated.body,
    extraProperties,
    tags: [...new Set(tags)],
  });

  const { issues, ...reviewSummary } = generated.review;

  const summary = {
    id: result.id,
    slug: generated.slug,
    status: "active",
    title: generated.title,
    updated_at: result.updated_at,
    file_path: filePath,
    model: generated.model,
    review: reviewSummary,
    transcript: generated.transcript,
    artifacts_dir: generated.artifacts_dir,
    prompt_path: generated.prompt_path,
  };

  // The handoff body is never returned: it is written for the next session to Read, and echoing it
  // here would pull the whole document into the calling agent's context.
  if (outputMode === "compact") {
    outputJson(summary);
    return;
  }
  outputJson({ ...summary, review: { ...reviewSummary, issues } });
}

async function handoffList(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    status: { type: "string" },
    repo: { type: "string" },
    tags: { type: "string" },
  });

  const statusFilter = (values.status as string | undefined) ?? "active";
  const tags = (values.tags as string | undefined)?.split(",");

  const results = db.search({
    kind: "handoff",
    limit: 1000,
    offset: 0,
    tags: tags?.length ? tags : undefined,
  });

  let filtered = results.nodes.filter((n) => {
    const props = n.properties as Record<string, unknown> | undefined;
    return props?.status === statusFilter;
  });

  if (values.repo) {
    const repoStr = values.repo as string;
    if (!repoStr.includes("/")) exitWithError("Error: --repo must be in owner/name format");
    const [repoOwner, repoName] = repoStr.split("/");
    filtered = filtered.filter((n) => {
      const props = n.properties as Record<string, unknown> | undefined;
      return props?.repo_owner === repoOwner && props?.repo_name === repoName;
    });
  }

  const output = filtered.map((n) => {
    const props = n.properties as Record<string, unknown> | undefined;
    const title = n.body?.split("\n")[0]?.replace(/^#\s*/, "") ?? "";
    return {
      id: n.id,
      slug: props?.slug,
      status: props?.status,
      title,
      updated_at: n.updated_at,
      file_path: path.join(HANDOFF_DIR, `${n.id}.md`),
    };
  });

  outputJson(output);
}

async function handoffGet(db: Database, args: string[]): Promise<void> {
  const { positionals } = parseCli(args, {});
  const [idOrSlug] = positionals;
  if (!idOrSlug) exitWithError("Usage: sd handoff get <id-or-slug>");

  const node = resolveByIdOrSlug(db, idOrSlug);
  if (!node) exitWithError(`Error: handoff not found: ${idOrSlug}`);
  outputJson({ ...node, file_path: path.join(HANDOFF_DIR, `${node.id}.md`) });
}

async function handoffComplete(db: Database, args: string[]): Promise<void> {
  const { positionals } = parseCli(args, {});
  const [idOrSlug] = positionals;
  if (!idOrSlug) exitWithError("Usage: sd handoff complete <id-or-slug>");

  const node = resolveByIdOrSlug(db, idOrSlug);
  if (!node) exitWithError(`Error: handoff not found: ${idOrSlug}`);

  const existingProps = (node.properties as Record<string, unknown>) ?? {};
  const mergedProps = { ...existingProps, status: "completed" };

  const result = db.updateNode({ id: node.id, properties: mergedProps });
  outputJson(result);
}
