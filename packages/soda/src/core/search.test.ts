import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "./database";

describe("SearchIndex via Database", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("create node with keywords_en → searchable by keyword", () => {
    db.createNode({
      body: "Some body text",
      kind: "idea",
      properties: { keywords_en: ["quantum", "computing"], summary_en: "quantum computing" },
    });

    const result = db.search({ limit: 10, offset: 0, query: "quantum" });
    expect(result.total).toBe(1);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].properties.summary_en).toBe("quantum computing");
  });

  it("search with no query → returns recent nodes ordered by updated_at", async () => {
    const n1 = db.createNode({ body: "first", kind: "memo" });
    await new Promise<void>((r) => {
      setTimeout(r, 5);
    });
    const n2 = db.createNode({ body: "second", kind: "memo" });
    await new Promise<void>((r) => {
      setTimeout(r, 5);
    });
    const n3 = db.createNode({ body: "third", kind: "memo" });

    const result = db.search({ limit: 10, offset: 0 });
    expect(result.total).toBe(3);
    // Most recently updated should be first
    expect(result.nodes[0].id).toBe(n3.id);
    expect(result.nodes[1].id).toBe(n2.id);
    expect(result.nodes[2].id).toBe(n1.id);
  });

  it("search with kind filter → only matching kind returned", () => {
    db.createNode({ body: "a memo", kind: "memo" });
    db.createNode({ body: "an idea", kind: "idea" });
    db.createNode({ body: "another memo", kind: "memo" });

    const result = db.search({ kind: "memo", limit: 10, offset: 0 });
    expect(result.total).toBe(2);
    expect(result.nodes.every((n) => n.kind === "memo")).toBe(true);
  });

  it("search with tag filter → only nodes with all specified tags", () => {
    db.createNode({ body: "both tags", kind: "memo", tags: ["alpha", "beta"] });
    db.createNode({ body: "alpha only", kind: "memo", tags: ["alpha"] });
    db.createNode({ body: "beta only", kind: "memo", tags: ["beta"] });
    db.createNode({ body: "no tags", kind: "memo" });

    const result = db.search({ limit: 10, offset: 0, tags: ["alpha", "beta"] });
    expect(result.total).toBe(1);
    expect(result.nodes[0].body).toBe("both tags");
  });

  it("combined query + kind + tags filter", () => {
    db.createNode({
      body: "matching idea",
      kind: "idea",
      properties: { keywords_en: ["ml"], summary_en: "machine learning" },
      tags: ["tech"],
    });
    db.createNode({
      body: "wrong kind",
      kind: "memo",
      properties: { keywords_en: ["ml"], summary_en: "machine learning reference" },
      tags: ["tech"],
    });
    db.createNode({
      body: "wrong tag",
      kind: "idea",
      properties: { keywords_en: ["ml"], summary_en: "machine learning notes" },
      tags: ["science"],
    });
    db.createNode({
      body: "no fts match",
      kind: "idea",
      properties: { keywords_en: ["food"], summary_en: "cooking recipes" },
      tags: ["tech"],
    });

    const result = db.search({ kind: "idea", limit: 10, offset: 0, query: "ml", tags: ["tech"] });
    expect(result.total).toBe(1);
    expect(result.nodes[0].body).toBe("matching idea");
  });

  it("pagination: limit=2, offset=0 returns first 2; offset=2 returns next", () => {
    db.createNode({ body: "node1", kind: "memo" });
    db.createNode({ body: "node2", kind: "memo" });
    db.createNode({ body: "node3", kind: "memo" });
    db.createNode({ body: "node4", kind: "memo" });

    const page1 = db.search({ limit: 2, offset: 0 });
    expect(page1.nodes).toHaveLength(2);

    const page2 = db.search({ limit: 2, offset: 2 });
    expect(page2.nodes).toHaveLength(2);

    // No overlap
    const ids1 = page1.nodes.map((n) => n.id);
    const ids2 = page2.nodes.map((n) => n.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("total count is correct regardless of limit/offset", () => {
    for (let i = 0; i < 5; i++) {
      db.createNode({ body: `node ${i}`, kind: "memo" });
    }

    const page1 = db.search({ limit: 2, offset: 0 });
    const page2 = db.search({ limit: 2, offset: 2 });
    const page3 = db.search({ limit: 2, offset: 4 });

    expect(page1.total).toBe(5);
    expect(page2.total).toBe(5);
    expect(page3.total).toBe(5);
  });

  it("index sync: create node → searchable", () => {
    db.createNode({
      body: "neural networks",
      kind: "idea",
      properties: { keywords_en: ["neural", "networks"], summary_en: "deep learning" },
    });

    const result = db.search({ limit: 10, offset: 0, query: "neural" });
    expect(result.total).toBe(1);
  });

  it("index sync: update properties → re-indexed", () => {
    const node = db.createNode({
      body: "original content",
      kind: "idea",
      properties: { keywords_en: ["old"], summary_en: "old topic" },
    });

    // Verify searchable with old keyword
    let result = db.search({ limit: 10, offset: 0, query: "old" });
    expect(result.total).toBe(1);

    // Update properties
    db.updateNode({
      id: node.id,
      properties: { keywords_en: ["new", "updated"], summary_en: "new topic" },
    });

    // Old keyword should no longer match
    result = db.search({ limit: 10, offset: 0, query: "old" });
    expect(result.total).toBe(0);

    // New keyword should match
    result = db.search({ limit: 10, offset: 0, query: "updated" });
    expect(result.total).toBe(1);
  });

  it("index sync: delete node → removed from FTS", () => {
    const node = db.createNode({
      body: "to be deleted",
      kind: "idea",
      properties: { keywords_en: ["deleteme"], summary_en: "deleteme topic" },
    });

    let result = db.search({ limit: 10, offset: 0, query: "deleteme" });
    expect(result.total).toBe(1);

    db.deleteNode(node.id);

    result = db.search({ limit: 10, offset: 0, query: "deleteme" });
    expect(result.total).toBe(0);
  });

  it("node without summary_en/keywords_en → not found via FTS, but found via kind/tag filters", () => {
    db.createNode({
      body: "plain node without english metadata",
      kind: "memo",
      tags: ["plain"],
    });

    // FTS search should not find it
    const ftsResult = db.search({ limit: 10, offset: 0, query: "plain" });
    expect(ftsResult.total).toBe(0);

    // Kind filter should find it
    const kindResult = db.search({ kind: "memo", limit: 10, offset: 0 });
    expect(kindResult.total).toBe(1);

    // Tag filter should find it
    const tagResult = db.search({ limit: 10, offset: 0, tags: ["plain"] });
    expect(tagResult.total).toBe(1);
  });
});
