import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "./database";

describe("Database - Tag Operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("addTags to node → getNode returns updated tags array", () => {
    const node = db.createNode({ body: "Tag test", kind: "memo" });
    db.addTags(node.id, ["foo", "bar"]);

    const fetched = db.getNode(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.tags).toHaveLength(2);
    expect(fetched!.tags).toContain("foo");
    expect(fetched!.tags).toContain("bar");
  });

  it("addTags with duplicate → no error, tag appears once", () => {
    const node = db.createNode({ kind: "memo", tags: ["existing"] });
    db.addTags(node.id, ["existing", "new"]);

    const fetched = db.getNode(node.id);
    expect(fetched).not.toBeNull();
    const existingCount = fetched!.tags.filter((t) => t === "existing").length;
    expect(existingCount).toBe(1);
    expect(fetched!.tags).toContain("new");
  });

  it("addTags to non-existent node → throws error", () => {
    expect(() => db.addTags("nonexistent-id", ["foo"])).toThrow();
  });

  it("removeTags → tag removed from node", () => {
    const node = db.createNode({ kind: "memo", tags: ["keep", "remove"] });
    db.removeTags(node.id, ["remove"]);

    const fetched = db.getNode(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.tags).toContain("keep");
    expect(fetched!.tags).not.toContain("remove");
  });

  it("removeTags for non-existent tag → no error", () => {
    const node = db.createNode({ kind: "memo", tags: ["alpha"] });
    expect(() => db.removeTags(node.id, ["nonexistent"])).not.toThrow();

    const fetched = db.getNode(node.id);
    expect(fetched!.tags).toContain("alpha");
  });

  it("removeTags from non-existent node → throws error", () => {
    expect(() => db.removeTags("nonexistent-id", ["foo"])).toThrow();
  });
});
