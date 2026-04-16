import { mkdirSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import type { Database } from "../../core/database.js";
import { exitWithError, outputJson, parseCli } from "../helpers.js";

const HANDOFF_DIR = path.join(os.homedir(), ".soda-agent-tools", "handoffs");

export async function handleHandoff(db: Database, args: string[]): Promise<void> {
  const [action] = args;
  const rest = args.slice(1);

  switch (action) {
    case "write":
      return handoffWrite(db, rest);
    case "list":
      return handoffList(db, rest);
    case "get":
      return handoffGet(db, rest);
    case "complete":
      return handoffComplete(db, rest);
    default:
      exitWithError("Usage: sd handoff <write|list|get|complete>");
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

async function handoffWrite(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    slug: { type: "string" },
    "repo-owner": { type: "string" },
    "repo-name": { type: "string" },
    tags: { type: "string" },
    stdin: { default: false, type: "boolean" },
  });

  const slug = values.slug as string | undefined;
  if (!slug) exitWithError("Error: --slug is required");

  // Read raw Markdown from stdin (NOT JSON)
  const body = (await Bun.stdin.text()).trimEnd();
  if (!body) exitWithError("Error: no input received on stdin");

  const properties: Record<string, unknown> = {
    status: "active",
    slug,
  };
  if (values["repo-owner"]) properties.repo_owner = values["repo-owner"];
  if (values["repo-name"]) properties.repo_name = values["repo-name"];

  const tags = (values.tags as string | undefined)?.split(",");

  // Upsert: find existing active handoff with same slug
  const existing = db.search({ kind: "handoff", limit: 1000, offset: 0 });
  const match = existing.nodes.find((n) => {
    const props = n.properties as Record<string, unknown> | undefined;
    return props?.slug === slug && props?.status === "active";
  });

  let result;
  if (match) {
    const mergedProps = { ...(match.properties as Record<string, unknown>), ...properties };
    result = db.updateNode({ id: match.id, body, properties: mergedProps });
  } else {
    result = db.createNode({ kind: "handoff", body, properties, tags });
  }

  const filePath = exportFile(result.id, body);
  outputJson({ ...result, file_path: filePath });
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
