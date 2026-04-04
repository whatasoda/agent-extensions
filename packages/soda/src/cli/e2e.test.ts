import { afterEach, describe, expect, it } from "bun:test";
import { unlinkSync } from "fs";
import path from "path";
import os from "os";

const CLI_PATH = path.resolve(import.meta.dir, "../../src/cli.ts");
const TEST_DB = path.join(os.tmpdir(), `soda-agent-tools-e2e-${Date.now()}.db`);

async function run(
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
    env: { ...process.env, SODA_AGENT_TOOLS_DB: TEST_DB },
    stderr: "pipe",
    stdin: stdin === undefined ? "pipe" : new Blob([stdin]),
    stdout: "pipe",
  });

  if (stdin === undefined && proc.stdin && typeof proc.stdin !== "number") {
    proc.stdin.end();
  }

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stderr, stdout };
}

function parseOutput(stdout: string): unknown {
  return JSON.parse(stdout.trim());
}

describe("CLI E2E", () => {
  afterEach(() => {
    try {
      unlinkSync(TEST_DB);
      unlinkSync(`${TEST_DB}-wal`);
      unlinkSync(`${TEST_DB}-shm`);
    } catch {
      // Ignore
    }
  });

  describe("node commands", () => {
    it("creates and retrieves a node via args", async () => {
      const createResult = await run([
        "node",
        "create",
        "--kind",
        "memo",
        "--body",
        "E2E test",
        "--tags",
        "test,e2e",
      ]);
      expect(createResult.exitCode).toBe(0);
      const created = parseOutput(createResult.stdout) as { id: string };
      expect(created.id).toHaveLength(26);

      const getResult = await run(["node", "get", created.id]);
      expect(getResult.exitCode).toBe(0);
      const node = parseOutput(getResult.stdout) as {
        body: string;
        kind: string;
        tags: string[];
      };
      expect(node.kind).toBe("memo");
      expect(node.body).toBe("E2E test");
      expect(node.tags).toContain("test");
      expect(node.tags).toContain("e2e");
      expect(node.tags).toHaveLength(2);
    });

    it("creates a node via --stdin with heredoc-style JSON", async () => {
      const input = JSON.stringify({
        body: "stdin test",
        kind: "conversation",
        properties: {
          context: "test context",
          decisions: ["decision1"],
          key_points: ["point1"],
          keywords_en: ["test"],
          open_questions: [],
          summary_en: "A test conversation",
        },
        tags: ["stdin"],
      });

      const result = await run(["node", "create", "--stdin"], input);
      expect(result.exitCode).toBe(0);
      const created = parseOutput(result.stdout) as {
        kind: string;
        properties: Record<string, unknown>;
      };
      expect(created.kind).toBe("conversation");
      expect(created.properties.summary_en).toBe("A test conversation");
    });

    it("searches nodes", async () => {
      await run(["node", "create", "--kind", "memo", "--body", "searchable"]);
      await run(["node", "create", "--kind", "todo", "--body", "other"]);

      const result = await run(["node", "search", "--kind", "memo"]);
      expect(result.exitCode).toBe(0);
      const search = parseOutput(result.stdout) as { nodes: unknown[]; total: number };
      expect(search.total).toBe(1);
    });

    it("updates a node", async () => {
      const createResult = await run(["node", "create", "--kind", "memo", "--body", "original"]);
      const created = parseOutput(createResult.stdout) as { id: string };

      const updateResult = await run([
        "node",
        "update",
        created.id,
        "--body",
        "updated",
        "--kind",
        "idea",
      ]);
      expect(updateResult.exitCode).toBe(0);
      const updated = parseOutput(updateResult.stdout) as { body: string; kind: string };
      expect(updated.body).toBe("updated");
      expect(updated.kind).toBe("idea");
    });

    it("deletes a node", async () => {
      const createResult = await run(["node", "create", "--kind", "memo", "--body", "to delete"]);
      const created = parseOutput(createResult.stdout) as { id: string };

      const deleteResult = await run(["node", "delete", created.id]);
      expect(deleteResult.exitCode).toBe(0);

      const getResult = await run(["node", "get", created.id]);
      expect(getResult.exitCode).toBe(0);
      expect(parseOutput(getResult.stdout)).toBeNull();
    });
  });

  describe("tag commands", () => {
    it("adds and removes tags", async () => {
      const createResult = await run(["node", "create", "--kind", "memo"]);
      const created = parseOutput(createResult.stdout) as { id: string };

      const addResult = await run(["tag", "add", created.id, "foo", "bar"]);
      expect(addResult.exitCode).toBe(0);

      const getResult = await run(["node", "get", created.id]);
      const node = parseOutput(getResult.stdout) as { tags: string[] };
      expect(node.tags).toContain("foo");
      expect(node.tags).toContain("bar");

      const removeResult = await run(["tag", "remove", created.id, "foo"]);
      expect(removeResult.exitCode).toBe(0);

      const getResult2 = await run(["node", "get", created.id]);
      const node2 = parseOutput(getResult2.stdout) as { tags: string[] };
      expect(node2.tags).not.toContain("foo");
      expect(node2.tags).toContain("bar");
    });
  });

  describe("link commands", () => {
    it("creates, lists, and deletes links", async () => {
      const r1 = await run(["node", "create", "--kind", "memo"]);
      const r2 = await run(["node", "create", "--kind", "idea"]);
      const n1 = parseOutput(r1.stdout) as { id: string };
      const n2 = parseOutput(r2.stdout) as { id: string };

      const createLink = await run(["link", "create", n1.id, n2.id, "--type", "relates_to"]);
      expect(createLink.exitCode).toBe(0);

      const listLinks = await run(["link", "list", n1.id, "--direction", "from"]);
      expect(listLinks.exitCode).toBe(0);
      const links = parseOutput(listLinks.stdout) as { to_id: string }[];
      expect(links).toHaveLength(1);
      expect(links[0].to_id).toBe(n2.id);

      const deleteLink = await run(["link", "delete", n1.id, n2.id, "--type", "relates_to"]);
      expect(deleteLink.exitCode).toBe(0);

      const listLinks2 = await run(["link", "list", n1.id]);
      const links2 = parseOutput(listLinks2.stdout) as unknown[];
      expect(links2).toHaveLength(0);
    });
  });

  describe("list commands", () => {
    it("lists kinds and tags", async () => {
      await run(["node", "create", "--kind", "memo", "--tags", "foo"]);
      await run(["node", "create", "--kind", "memo", "--tags", "bar"]);
      await run(["node", "create", "--kind", "todo"]);

      const kindsResult = await run(["list", "kinds"]);
      expect(kindsResult.exitCode).toBe(0);
      const kinds = parseOutput(kindsResult.stdout) as { kind: string; count: number }[];
      expect(kinds.find((k) => k.kind === "memo")?.count).toBe(2);
      expect(kinds.find((k) => k.kind === "todo")?.count).toBe(1);

      const tagsResult = await run(["list", "tags"]);
      expect(tagsResult.exitCode).toBe(0);
      const tags = parseOutput(tagsResult.stdout) as { tag: string; count: number }[];
      expect(tags.find((t) => t.tag === "foo")?.count).toBe(1);
    });
  });

  describe("decision commands", () => {
    it("creates a decision with required flags", async () => {
      const result = await run([
        "decision",
        "create",
        "--constraint",
        "test constraint",
        "--why",
        "test reason",
        "--scope",
        "test scope",
      ]);
      expect(result.exitCode).toBe(0);
      const node = parseOutput(result.stdout) as {
        kind: string;
        body: string;
        properties: Record<string, unknown>;
      };
      expect(node.kind).toBe("decision");
      expect(node.body).toBe("test constraint");
      expect(node.properties.constraint).toBe("test constraint");
      expect(node.properties.why).toBe("test reason");
      expect(node.properties.scope).toBe("test scope");
    });

    it("lists decisions", async () => {
      await run(["decision", "create", "--constraint", "c1", "--why", "w1", "--scope", "s1"]);
      await run(["decision", "create", "--constraint", "c2", "--why", "w2", "--scope", "s2"]);

      const result = await run(["decision", "list"]);
      expect(result.exitCode).toBe(0);
      const decisions = parseOutput(result.stdout) as unknown[];
      expect(decisions.length).toBe(2);
    });

    it("filters by tag", async () => {
      await run([
        "decision",
        "create",
        "--constraint",
        "tagged",
        "--why",
        "w",
        "--scope",
        "s",
        "--tag",
        "topic:alpha",
      ]);
      await run(["decision", "create", "--constraint", "untagged", "--why", "w", "--scope", "s"]);

      const result = await run(["decision", "list", "--tag", "topic:alpha"]);
      expect(result.exitCode).toBe(0);
      const decisions = parseOutput(result.stdout) as { body: string }[];
      expect(decisions.length).toBe(1);
      expect(decisions[0].body).toBe("tagged");
    });

    it("filters by repo", async () => {
      await run([
        "decision",
        "create",
        "--constraint",
        "repo-scoped",
        "--why",
        "w",
        "--scope",
        "s",
        "--repo-owner",
        "octo",
        "--repo-name",
        "repo",
      ]);
      await run(["decision", "create", "--constraint", "no-repo", "--why", "w", "--scope", "s"]);

      const result = await run(["decision", "list", "--repo", "octo/repo"]);
      expect(result.exitCode).toBe(0);
      const decisions = parseOutput(result.stdout) as { body: string }[];
      expect(decisions.length).toBe(1);
      expect(decisions[0].body).toBe("repo-scoped");
    });
  });

  describe("error handling", () => {
    it("exits with error for unknown command", async () => {
      const result = await run(["unknown"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Usage:");
    });

    it("exits with error for missing required args", async () => {
      const result = await run(["node", "create"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--kind");
    });

    it("exits with error for nonexistent node operations", async () => {
      const result = await run(["node", "delete", "01234567890123456789012345"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error:");
    });
  });
});
