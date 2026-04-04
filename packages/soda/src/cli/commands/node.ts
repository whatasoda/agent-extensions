import type { Database } from "../../core/database.js";
import { exitWithError, outputJson, parseCli, parseProps, readStdin } from "../helpers.js";

export async function handleNode(db: Database, args: string[]): Promise<void> {
  const [action] = args;
  const rest = args.slice(1);

  switch (action) {
    case "create":
      return nodeCreate(db, rest);
    case "get":
      return nodeGet(db, rest);
    case "update":
      return nodeUpdate(db, rest);
    case "delete":
      return nodeDelete(db, rest);
    case "search":
      return nodeSearch(db, rest);
    default:
      exitWithError("Usage: sd node <create|get|update|delete|search>");
  }
}

async function nodeCreate(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    body: { type: "string" },
    kind: { type: "string" },
    prop: { multiple: true, type: "string" },
    "props-json": { type: "string" },
    stdin: { default: false, type: "boolean" },
    tags: { type: "string" },
  });

  if (values.stdin) {
    const input = (await readStdin()) as Record<string, unknown>;
    const result = db.createNode({
      body: input.body as string | undefined,
      kind: input.kind as string,
      properties: input.properties as Record<string, unknown> | undefined,
      tags: input.tags as string[] | undefined,
    });
    return outputJson(result);
  }

  if (!values.kind) {
    exitWithError("Error: --kind is required");
  }

  const properties = parseProps(
    values.prop as string[] | undefined,
    values["props-json"] as string | undefined,
  );
  const tags = (values.tags as string | undefined)?.split(",");

  const result = db.createNode({
    body: values.body as string | undefined,
    kind: values.kind as string,
    properties,
    tags,
  });
  outputJson(result);
}

async function nodeGet(db: Database, args: string[]): Promise<void> {
  const { positionals } = parseCli(args, {});
  const [id] = positionals;
  if (!id) {
    exitWithError("Usage: sd node get <id>");
  }
  const result = db.getNode(id);
  outputJson(result);
}

async function nodeUpdate(db: Database, args: string[]): Promise<void> {
  const { positionals, values } = parseCli(args, {
    body: { type: "string" },
    kind: { type: "string" },
    prop: { multiple: true, type: "string" },
    "props-json": { type: "string" },
    stdin: { default: false, type: "boolean" },
  });

  const [id] = positionals;
  if (!id) {
    exitWithError("Usage: sd node update <id> [--body ...] [--kind ...] [--prop ...] [--stdin]");
  }

  if (values.stdin) {
    const input = (await readStdin()) as Record<string, unknown>;
    const result = db.updateNode({
      body: input.body as string | undefined,
      id,
      kind: input.kind as string | undefined,
      properties: input.properties as Record<string, unknown> | undefined,
    });
    return outputJson(result);
  }

  const properties = parseProps(
    values.prop as string[] | undefined,
    values["props-json"] as string | undefined,
  );

  const result = db.updateNode({
    body: values.body as string | undefined,
    id,
    kind: values.kind as string | undefined,
    properties,
  });
  outputJson(result);
}

async function nodeDelete(db: Database, args: string[]): Promise<void> {
  const { positionals } = parseCli(args, {});
  const [id] = positionals;
  if (!id) {
    exitWithError("Usage: sd node delete <id>");
  }
  db.deleteNode(id);
  outputJson({ success: true });
}

async function nodeSearch(db: Database, args: string[]): Promise<void> {
  const { values } = parseCli(args, {
    kind: { type: "string" },
    limit: { type: "string" },
    offset: { type: "string" },
    query: { type: "string" },
    tags: { type: "string" },
  });

  const tags = (values.tags as string | undefined)?.split(",");
  const result = db.search({
    kind: values.kind as string | undefined,
    limit: values.limit ? parseInt(values.limit as string, 10) : 20,
    offset: values.offset ? parseInt(values.offset as string, 10) : 0,
    query: values.query as string | undefined,
    tags,
  });
  outputJson(result);
}
