import { describe, expect, it } from "bun:test";
import { parseProps } from "./helpers.js";

describe("parseProps", () => {
  it("returns undefined when no props given", () => {
    expect(parseProps(undefined, undefined)).toBeUndefined();
    expect(parseProps([], undefined)).toBeUndefined();
  });

  it("parses --prop key=value pairs", () => {
    const result = parseProps(["status=done", "priority=high"], undefined);
    expect(result).toEqual({ priority: "high", status: "done" });
  });

  it("handles values containing equals signs", () => {
    const result = parseProps(["formula=a=b+c"], undefined);
    expect(result).toEqual({ formula: "a=b+c" });
  });

  it("parses --props-json", () => {
    const result = parseProps(undefined, '{"keywords_en":["foo","bar"]}');
    expect(result).toEqual({ keywords_en: ["foo", "bar"] });
  });

  it("merges --prop and --props-json with --prop winning", () => {
    const result = parseProps(["status=done"], '{"status":"pending","priority":"high"}');
    expect(result).toEqual({ priority: "high", status: "done" });
  });
});
