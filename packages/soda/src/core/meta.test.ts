import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "./database";

describe("Database - Meta operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("empty DB → listKinds returns []", () => {
    const result = db.listKinds();
    expect(result).toEqual([]);
  });

  it("empty DB → listTags returns []", () => {
    const result = db.listTags();
    expect(result).toEqual([]);
  });

  it("create 3 memos, 2 todos → listKinds returns [{kind:'memo',count:3}, {kind:'todo',count:2}]", () => {
    db.createNode({ body: "memo 1", kind: "memo" });
    db.createNode({ body: "memo 2", kind: "memo" });
    db.createNode({ body: "memo 3", kind: "memo" });
    db.createNode({ body: "todo 1", kind: "todo" });
    db.createNode({ body: "todo 2", kind: "todo" });

    const result = db.listKinds();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ count: 3, kind: "memo" });
    expect(result[1]).toEqual({ count: 2, kind: "todo" });
  });

  it("add tags to nodes → listTags returns correct counts, ordered by count DESC", () => {
    const n1 = db.createNode({ body: "node 1", kind: "memo" });
    const n2 = db.createNode({ body: "node 2", kind: "memo" });
    const n3 = db.createNode({ body: "node 3", kind: "memo" });

    db.addTags(n1.id, ["alpha", "beta"]);
    db.addTags(n2.id, ["alpha", "gamma"]);
    db.addTags(n3.id, ["alpha"]);

    const result = db.listTags();
    // Alpha appears 3 times, beta and gamma once each
    expect(result[0]).toEqual({ count: 3, tag: "alpha" });
    // Beta and gamma both count 1; order between them is unspecified but count must be 1
    expect(result).toHaveLength(3);
    const betaOrGamma = result.slice(1).map((r) => r.tag);
    expect(betaOrGamma).toContain("beta");
    expect(betaOrGamma).toContain("gamma");
    for (const r of result.slice(1)) {
      expect(r.count).toBe(1);
    }
  });

  it("delete a node → counts update correctly", () => {
    const n1 = db.createNode({ body: "memo 1", kind: "memo", tags: ["alpha"] });
    const n2 = db.createNode({ body: "memo 2", kind: "memo", tags: ["alpha"] });
    db.createNode({ body: "todo 1", kind: "todo" });

    // Before deletion
    let kinds = db.listKinds();
    expect(kinds.find((k) => k.kind === "memo")?.count).toBe(2);
    expect(kinds.find((k) => k.kind === "todo")?.count).toBe(1);

    let tags = db.listTags();
    expect(tags.find((t) => t.tag === "alpha")?.count).toBe(2);

    // Delete one memo node
    db.deleteNode(n1.id);

    kinds = db.listKinds();
    expect(kinds.find((k) => k.kind === "memo")?.count).toBe(1);
    expect(kinds.find((k) => k.kind === "todo")?.count).toBe(1);

    tags = db.listTags();
    expect(tags.find((t) => t.tag === "alpha")?.count).toBe(1);

    // Delete the second memo (with the alpha tag)
    db.deleteNode(n2.id);

    kinds = db.listKinds();
    expect(kinds.find((k) => k.kind === "memo")).toBeUndefined();

    tags = db.listTags();
    expect(tags.find((t) => t.tag === "alpha")).toBeUndefined();
  });
});
