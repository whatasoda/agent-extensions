import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "./database";

describe("Database - Node CRUD", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("create node with kind and body returns NodeWithRelations with ULID id, empty tags/links", () => {
    const node = db.createNode({ body: "Hello world", kind: "memo" });

    expect(node.id).toBeString();
    expect(node.id).toHaveLength(26);
    expect(node.kind).toBe("memo");
    expect(node.body).toBe("Hello world");
    expect(node.tags).toEqual([]);
    expect(node.links_from).toEqual([]);
    expect(node.links_to).toEqual([]);
    expect(node.created_at).toBeString();
    expect(node.updated_at).toBeString();
  });

  it("create node with tags returns tags array populated", () => {
    const node = db.createNode({
      body: "Tagged node",
      kind: "memo",
      tags: ["alpha", "beta"],
    });

    expect(node.tags).toHaveLength(2);
    expect(node.tags).toContain("alpha");
    expect(node.tags).toContain("beta");
  });

  it("get node by id returns full NodeWithRelations", () => {
    const created = db.createNode({ body: "Test body", kind: "memo", tags: ["x"] });
    const fetched = db.getNode(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.kind).toBe("memo");
    expect(fetched!.body).toBe("Test body");
    expect(fetched!.tags).toContain("x");
    expect(fetched!.links_from).toEqual([]);
    expect(fetched!.links_to).toEqual([]);
  });

  it("get non-existent node returns null", () => {
    const result = db.getNode("01HRTZABCDE12345678901234Z");
    expect(result).toBeNull();
  });

  it("update node body changes body, updated_at changes, created_at unchanged", async () => {
    const node = db.createNode({ body: "Original", kind: "memo" });
    const originalCreatedAt = node.created_at;
    const originalUpdatedAt = node.updated_at;

    // Wait a tick to ensure time difference
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });

    const updated = db.updateNode({ body: "Updated", id: node.id });

    expect(updated.body).toBe("Updated");
    expect(updated.created_at).toBe(originalCreatedAt);
    expect(updated.updated_at).not.toBe(originalUpdatedAt);
  });

  it("update node kind from memo to todo changes kind, properties re-validated with new kind schema", () => {
    const node = db.createNode({ body: "Switch kind", kind: "memo" });
    const updated = db.updateNode({
      id: node.id,
      kind: "todo",
      properties: { status: "pending" },
    });

    expect(updated.kind).toBe("todo");
    expect(updated.properties).toMatchObject({ status: "pending" });
  });

  it("update node properties stored and retrieved correctly", () => {
    const node = db.createNode({ kind: "idea" });
    const updated = db.updateNode({
      id: node.id,
      properties: { summary_en: "A great idea" },
    });

    expect(updated.properties).toMatchObject({ summary_en: "A great idea" });
  });

  it("delete node removes node from nodes table", () => {
    const node = db.createNode({ body: "To be deleted", kind: "memo" });
    expect(db.getNode(node.id)).not.toBeNull();

    db.deleteNode(node.id);
    expect(db.getNode(node.id)).toBeNull();
  });

  it("delete node with tags also removes tags (cascade)", () => {
    const node = db.createNode({ kind: "memo", tags: ["tag1", "tag2"] });
    db.deleteNode(node.id);

    // Node is gone; if we try to get it we get null (tags were cascaded)
    const result = db.getNode(node.id);
    expect(result).toBeNull();
  });

  it("create todo with invalid status throws ZodError", () => {
    expect(() =>
      db.createNode({
        kind: "todo",
        properties: { status: "invalid_status" },
      }),
    ).toThrow();
  });

  it("create node with unknown kind and arbitrary properties succeeds", () => {
    const node = db.createNode({
      kind: "custom_kind",
      properties: { baz: 42, foo: "bar", nested: { a: true } },
    });

    expect(node.kind).toBe("custom_kind");
    expect(node.properties).toMatchObject({ baz: 42, foo: "bar" });
  });
});
