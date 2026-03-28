import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { listRegisteredKinds, registerKind, validateProperties } from "./kinds";

describe("validateProperties", () => {
  it("succeeds for todo with valid status", () => {
    const result = validateProperties("todo", { status: "pending" });
    expect(result).toMatchObject({ status: "pending" });
  });

  it("throws for todo with invalid status", () => {
    expect(() => validateProperties("todo", { status: "invalid" })).toThrow();
  });

  it("applies defaults for todo with empty props", () => {
    const result = validateProperties("todo", {});
    expect(result).toMatchObject({ status: "pending" });
  });

  it("passes through unknown kinds without error", () => {
    const result = validateProperties("unknown_kind", { anything: true });
    expect(result).toEqual({ anything: true });
  });
});

describe("listRegisteredKinds", () => {
  it("returns all 5 built-in kinds", () => {
    const kinds = listRegisteredKinds();
    expect(kinds).toContain("memo");
    expect(kinds).toContain("todo");
    expect(kinds).toContain("conversation");
    expect(kinds).toContain("idea");
    expect(kinds).toContain("decision");
    expect(kinds.length).toBeGreaterThanOrEqual(5);
  });
});

describe("registerKind", () => {
  it("adds new kind and validateProperties works for it", () => {
    registerKind("test_kind", z.object({ name: z.string() }));
    const result = validateProperties("test_kind", { name: "hello" });
    expect(result).toEqual({ name: "hello" });
    expect(() => validateProperties("test_kind", { name: 123 })).toThrow();
    expect(listRegisteredKinds()).toContain("test_kind");
  });
});
