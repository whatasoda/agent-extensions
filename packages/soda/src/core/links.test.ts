import { beforeEach, describe, expect, it } from "bun:test";
import { Database } from "./database.js";

describe("Link operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  it("createLink between two nodes returns a Link object", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });

    const link = db.createLink(nodeA.id, nodeB.id, "references");

    expect(link.from_id).toBe(nodeA.id);
    expect(link.to_id).toBe(nodeB.id);
    expect(link.link_type).toBe("references");
    expect(typeof link.created_at).toBe("string");
  });

  it("createLink to non-existent node throws an error", () => {
    const nodeA = db.createNode({ kind: "note" });

    expect(() => db.createLink(nodeA.id, "nonexistent-id", "references")).toThrow();
    expect(() => db.createLink("nonexistent-id", nodeA.id, "references")).toThrow();
  });

  it("duplicate link is idempotent (no error)", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });

    const link1 = db.createLink(nodeA.id, nodeB.id, "references");
    const link2 = db.createLink(nodeA.id, nodeB.id, "references");

    expect(link2.from_id).toBe(link1.from_id);
    expect(link2.to_id).toBe(link1.to_id);
    expect(link2.link_type).toBe(link1.link_type);
    expect(link2.created_at).toBe(link1.created_at);
  });

  it("deleteLink removes the link", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });

    db.createLink(nodeA.id, nodeB.id, "references");
    db.deleteLink(nodeA.id, nodeB.id, "references");

    const links = db.getLinks(nodeA.id, "from");
    expect(links).toHaveLength(0);
  });

  it("getLinks direction 'from' returns only outgoing links", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });
    const nodeC = db.createNode({ kind: "note" });

    db.createLink(nodeA.id, nodeB.id, "references");
    db.createLink(nodeC.id, nodeA.id, "references");

    const links = db.getLinks(nodeA.id, "from");
    expect(links).toHaveLength(1);
    expect(links[0].from_id).toBe(nodeA.id);
    expect(links[0].to_id).toBe(nodeB.id);
  });

  it("getLinks direction 'to' returns only incoming links", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });
    const nodeC = db.createNode({ kind: "note" });

    db.createLink(nodeA.id, nodeB.id, "references");
    db.createLink(nodeC.id, nodeA.id, "references");

    const links = db.getLinks(nodeA.id, "to");
    expect(links).toHaveLength(1);
    expect(links[0].from_id).toBe(nodeC.id);
    expect(links[0].to_id).toBe(nodeA.id);
  });

  it("getLinks direction 'both' returns outgoing and incoming links", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });
    const nodeC = db.createNode({ kind: "note" });

    db.createLink(nodeA.id, nodeB.id, "references");
    db.createLink(nodeC.id, nodeA.id, "references");

    const links = db.getLinks(nodeA.id, "both");
    expect(links).toHaveLength(2);

    const fromLinks = links.filter((l) => l.from_id === nodeA.id);
    const toLinks = links.filter((l) => l.to_id === nodeA.id);
    expect(fromLinks).toHaveLength(1);
    expect(toLinks).toHaveLength(1);
  });

  it("deleting a node cascades and removes its links", () => {
    const nodeA = db.createNode({ kind: "note" });
    const nodeB = db.createNode({ kind: "note" });

    db.createLink(nodeA.id, nodeB.id, "references");

    db.deleteNode(nodeA.id);

    const linksFromB = db.getLinks(nodeB.id, "to");
    expect(linksFromB).toHaveLength(0);
  });
});
