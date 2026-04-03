import type { Database } from "../../core/database.js";
import { exitWithError, outputJson, parseCli, readStdin } from "../helpers.js";

export async function handleDecision(db: Database, args: string[]): Promise<void> {
  const [action] = args;
  const rest = args.slice(1);

  switch (action) {
    case "create":
      return decisionCreate(db, rest);
    case "list":
      return decisionList(db, rest);
    case "import": {
      const { handleImport } = await import("./import.js");
      return handleImport(db, rest);
    }
    default:
      exitWithError("Usage: wat decision <create|list|import>");
  }
}

async function decisionCreate(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    constraint: { type: "string" },
    why: { type: "string" },
    scope: { type: "string" },
    "repo-owner": { type: "string" },
    "repo-name": { type: "string" },
    tag: { multiple: true, type: "string" },
    "rejected-alt-json": { type: "string" },
    stdin: { default: false, type: "boolean" },
  });

  if (values.stdin) {
    const input = (await readStdin()) as Record<string, unknown>;
    const result = db.createNode({
      body: input.constraint as string | undefined,
      kind: "decision",
      properties: input.properties as Record<string, unknown> | undefined,
      tags: input.tags as string[] | undefined,
    });
    return outputJson(result);
  }

  if (!values.constraint) {
    exitWithError("Error: --constraint is required");
  }
  if (!values.why) {
    exitWithError("Error: --why is required");
  }
  if (!values.scope) {
    exitWithError("Error: --scope is required");
  }

  const properties: Record<string, unknown> = {
    constraint: values.constraint,
    why: values.why,
    scope: values.scope,
  };

  if (values["repo-owner"]) {
    properties.repo_owner = values["repo-owner"];
  }
  if (values["repo-name"]) {
    properties.repo_name = values["repo-name"];
  }
  if (values["rejected-alt-json"]) {
    try {
      properties.rejected_alternatives = JSON.parse(values["rejected-alt-json"] as string);
    } catch {
      exitWithError("Error: invalid JSON in --rejected-alt-json");
    }
  }

  const tags = values.tag as string[] | undefined;

  const result = db.createNode({
    body: values.constraint as string,
    kind: "decision",
    properties,
    tags,
  });

  outputJson(result);
}

async function decisionList(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    tag: { multiple: true, type: "string" },
    repo: { type: "string" },
    limit: { type: "string" },
  });

  const tags = values.tag as string[] | undefined;
  const limit = values.limit ? parseInt(values.limit as string, 10) : 50;
  if (isNaN(limit)) exitWithError("Error: --limit must be a number");

  const results = db.search({
    kind: "decision",
    limit: values.repo ? Number.MAX_SAFE_INTEGER : limit,
    offset: 0,
    tags: tags?.length ? tags : undefined,
  });

  if (values.repo) {
    const repoStr = values.repo as string;
    if (!repoStr.includes("/")) exitWithError("Error: --repo must be in owner/name format");
    const [repoOwner, repoName] = repoStr.split("/");
    const filtered = results.nodes.filter((node) => {
      const props = node.properties as Record<string, unknown> | undefined;
      return props?.repo_owner === repoOwner && props?.repo_name === repoName;
    });
    return outputJson(filtered);
  }

  outputJson(results.nodes);
}
