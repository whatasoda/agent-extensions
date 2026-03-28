import { describe, expect, it } from "bun:test";
import {
  CreateLinkInput,
  CreateNodeInput,
  DeleteLinkInput,
  GetLinksInput,
  NodeIdInput,
  SearchNodesInput,
  TagsInput,
  UpdateNodeInput,
} from "./schemas";

// A valid 26-char ULID-like string for testing
const VALID_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("CreateNodeInput", () => {
  it("parses valid input", () => {
    const result = CreateNodeInput.parse({
      body: "hello",
      kind: "memo",
      properties: { x: 1 },
      tags: ["a"],
    });
    expect(result.kind).toBe("memo");
    expect(result.body).toBe("hello");
    expect(result.properties).toEqual({ x: 1 });
    expect(result.tags).toEqual(["a"]);
  });

  it("applies default body to empty string", () => {
    const result = CreateNodeInput.parse({ kind: "memo" });
    expect(result.body).toBe("");
  });

  it("applies default properties to empty object", () => {
    const result = CreateNodeInput.parse({ kind: "memo" });
    expect(result.properties).toEqual({});
  });

  it("allows optional tags to be omitted", () => {
    const result = CreateNodeInput.parse({ kind: "memo" });
    expect(result.tags).toBeUndefined();
  });

  it("throws on empty kind string", () => {
    expect(() => CreateNodeInput.parse({ kind: "" })).toThrow();
  });
});

describe("UpdateNodeInput", () => {
  it("parses valid input with all fields", () => {
    const result = UpdateNodeInput.parse({
      body: "updated",
      id: VALID_ID,
      kind: "todo",
      properties: { done: true },
    });
    expect(result.id).toBe(VALID_ID);
    expect(result.body).toBe("updated");
  });

  it("parses with only id (all optional fields omitted)", () => {
    const result = UpdateNodeInput.parse({ id: VALID_ID });
    expect(result.id).toBe(VALID_ID);
    expect(result.body).toBeUndefined();
    expect(result.kind).toBeUndefined();
    expect(result.properties).toBeUndefined();
  });

  it("throws on id with invalid length", () => {
    expect(() => UpdateNodeInput.parse({ id: "tooshort" })).toThrow();
  });

  it("throws on id that is too long", () => {
    expect(() => UpdateNodeInput.parse({ id: `${VALID_ID}X` })).toThrow();
  });
});

describe("SearchNodesInput", () => {
  it("parses valid input with all fields", () => {
    const result = SearchNodesInput.parse({
      kind: "memo",
      limit: 10,
      offset: 5,
      query: "test",
      tags: ["tag1"],
    });
    expect(result.query).toBe("test");
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  it("applies default limit of 20", () => {
    const result = SearchNodesInput.parse({});
    expect(result.limit).toBe(20);
  });

  it("applies default offset of 0", () => {
    const result = SearchNodesInput.parse({});
    expect(result.offset).toBe(0);
  });

  it("allows all optional fields to be omitted", () => {
    const result = SearchNodesInput.parse({});
    expect(result.query).toBeUndefined();
    expect(result.kind).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it("throws on limit exceeding 100", () => {
    expect(() => SearchNodesInput.parse({ limit: 101 })).toThrow();
  });

  it("throws on limit below 1", () => {
    expect(() => SearchNodesInput.parse({ limit: 0 })).toThrow();
  });

  it("throws on negative offset", () => {
    expect(() => SearchNodesInput.parse({ offset: -1 })).toThrow();
  });
});

describe("GetLinksInput", () => {
  it("parses valid input", () => {
    const result = GetLinksInput.parse({ direction: "from", node_id: VALID_ID });
    expect(result.node_id).toBe(VALID_ID);
    expect(result.direction).toBe("from");
  });

  it("applies default direction of 'both'", () => {
    const result = GetLinksInput.parse({ node_id: VALID_ID });
    expect(result.direction).toBe("both");
  });

  it("throws on invalid node_id length", () => {
    expect(() => GetLinksInput.parse({ node_id: "short" })).toThrow();
  });

  it("throws on invalid direction value", () => {
    expect(() => GetLinksInput.parse({ direction: "invalid", node_id: VALID_ID })).toThrow();
  });
});

describe("CreateLinkInput", () => {
  it("parses valid input", () => {
    const result = CreateLinkInput.parse({
      from_id: VALID_ID,
      link_type: "references",
      to_id: VALID_ID,
    });
    expect(result.from_id).toBe(VALID_ID);
    expect(result.to_id).toBe(VALID_ID);
    expect(result.link_type).toBe("references");
  });

  it("throws on invalid from_id length", () => {
    expect(() =>
      CreateLinkInput.parse({ from_id: "bad", link_type: "ref", to_id: VALID_ID }),
    ).toThrow();
  });

  it("throws on invalid to_id length", () => {
    expect(() =>
      CreateLinkInput.parse({ from_id: VALID_ID, link_type: "ref", to_id: "bad" }),
    ).toThrow();
  });

  it("throws on empty link_type", () => {
    expect(() =>
      CreateLinkInput.parse({ from_id: VALID_ID, link_type: "", to_id: VALID_ID }),
    ).toThrow();
  });
});

describe("TagsInput", () => {
  it("parses valid input", () => {
    const result = TagsInput.parse({ node_id: VALID_ID, tags: ["tag1", "tag2"] });
    expect(result.node_id).toBe(VALID_ID);
    expect(result.tags).toEqual(["tag1", "tag2"]);
  });

  it("throws on invalid node_id length", () => {
    expect(() => TagsInput.parse({ node_id: "bad", tags: ["tag1"] })).toThrow();
  });

  it("throws on empty tags array", () => {
    expect(() => TagsInput.parse({ node_id: VALID_ID, tags: [] })).toThrow();
  });

  it("throws on tag that is empty string", () => {
    expect(() => TagsInput.parse({ node_id: VALID_ID, tags: [""] })).toThrow();
  });
});

describe("NodeIdInput", () => {
  it("parses valid input", () => {
    const result = NodeIdInput.parse({ id: VALID_ID });
    expect(result.id).toBe(VALID_ID);
  });

  it("throws on id shorter than 26 chars", () => {
    expect(() => NodeIdInput.parse({ id: "short" })).toThrow();
  });

  it("throws on id longer than 26 chars", () => {
    expect(() => NodeIdInput.parse({ id: `${VALID_ID}X` })).toThrow();
  });
});

describe("DeleteLinkInput", () => {
  it("parses valid input", () => {
    const result = DeleteLinkInput.parse({
      from_id: VALID_ID,
      link_type: "references",
      to_id: VALID_ID,
    });
    expect(result.from_id).toBe(VALID_ID);
    expect(result.to_id).toBe(VALID_ID);
    expect(result.link_type).toBe("references");
  });

  it("throws on invalid from_id length", () => {
    expect(() =>
      DeleteLinkInput.parse({ from_id: "bad", link_type: "ref", to_id: VALID_ID }),
    ).toThrow();
  });

  it("throws on invalid to_id length", () => {
    expect(() =>
      DeleteLinkInput.parse({ from_id: VALID_ID, link_type: "ref", to_id: "bad" }),
    ).toThrow();
  });

  it("throws on empty link_type", () => {
    expect(() =>
      DeleteLinkInput.parse({ from_id: VALID_ID, link_type: "", to_id: VALID_ID }),
    ).toThrow();
  });
});
