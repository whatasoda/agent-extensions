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

describe("decision kind", () => {
  it("accepts valid input with constraint/why/scope", () => {
    const result = validateProperties("decision", {
      constraint: "Use SQLite for storage",
      why: "Simplicity and zero-dependency deployment",
      scope: "packages/soda",
    });
    expect(result).toMatchObject({
      constraint: "Use SQLite for storage",
      why: "Simplicity and zero-dependency deployment",
      scope: "packages/soda",
    });
  });

  it("rejects input missing required fields", () => {
    expect(() => validateProperties("decision", { constraint: "only constraint" })).toThrow();
    expect(() => validateProperties("decision", { why: "only why" })).toThrow();
    expect(() => validateProperties("decision", { scope: "only scope" })).toThrow();
    expect(() => validateProperties("decision", {})).toThrow();
  });

  it("defaults rejected_alternatives to empty array", () => {
    const result = validateProperties("decision", {
      constraint: "Use SQLite",
      why: "Simplicity",
      scope: "packages/soda",
    });
    expect((result as { rejected_alternatives: unknown[] }).rejected_alternatives).toEqual([]);
  });

  it("accepts optional repo_owner and repo_name", () => {
    const result = validateProperties("decision", {
      constraint: "Use SQLite",
      why: "Simplicity",
      scope: "packages/soda",
      repo_owner: "whatasoda",
      repo_name: "agent-extensions",
    });
    expect(result).toMatchObject({
      repo_owner: "whatasoda",
      repo_name: "agent-extensions",
    });
  });

  it("accepts rejected_alternatives with what and why_rejected", () => {
    const result = validateProperties("decision", {
      constraint: "Use SQLite",
      why: "Simplicity",
      scope: "packages/soda",
      rejected_alternatives: [{ what: "PostgreSQL", why_rejected: "Too heavy for local use" }],
    });
    expect(
      (result as { rejected_alternatives: { what: string; why_rejected: string }[] })
        .rejected_alternatives,
    ).toEqual([{ what: "PostgreSQL", why_rejected: "Too heavy for local use" }]);
  });
});

describe("conversation kind", () => {
  it("accepts valid input without decisions property", () => {
    const result = validateProperties("conversation", {
      context: "Planning session",
      key_points: ["Point A"],
      open_questions: ["Question 1"],
    });
    expect(result).toMatchObject({
      context: "Planning session",
      key_points: ["Point A"],
      open_questions: ["Question 1"],
    });
    expect(result).not.toHaveProperty("decisions");
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
