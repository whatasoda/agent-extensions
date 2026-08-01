import { describe, expect, test } from "bun:test";
import {
  buildPrompt,
  buildReviewPrompt,
  buildRevisePrompt,
  composeBody,
  countBlockers,
  type HandoffDraft,
  HandoffGenerationError,
  parseCodexResult,
  parseGitRemote,
  parseReviewResult,
  sanitizeSlug,
  sanitizeTag,
  selectTurnsWithinBudget,
} from "./generate.js";

const turn = (n: number, text: string) => ({
  turn: n,
  sourceLine: n * 10,
  role: n % 2 === 1 ? ("user" as const) : ("assistant" as const),
  text,
});

const draft = (overrides: Partial<HandoffDraft> = {}): HandoffDraft => ({
  title: "Move handoff generation to Codex",
  slug: "handoff-codex",
  keywords_en: ["handoff", "codex", "delegation"],
  tags: [],
  next_actions: ["Run bun run test", "Publish the package"],
  body_markdown: "Some body",
  ...overrides,
});

describe("sanitizeSlug", () => {
  test("kebab-cases and strips unsafe characters", () => {
    expect(sanitizeSlug("  WRM Daemon Distribution! ")).toBe("wrm-daemon-distribution");
    expect(sanitizeSlug("topic/sub_task")).toBe("topic-sub-task");
  });

  test("truncates to 50 characters without a trailing dash", () => {
    const slug = sanitizeSlug(`${"a".repeat(48)} tail`);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });

  test("returns an empty string when nothing usable remains", () => {
    expect(sanitizeSlug("日本語のみ")).toBe("");
  });
});

describe("sanitizeTag", () => {
  test("keeps namespaced tags intact", () => {
    expect(sanitizeTag("topic:wrm-daemon")).toBe("topic:wrm-daemon");
    expect(sanitizeTag("CI Setup")).toBe("ci-setup");
  });

  test("rejects tags with no usable characters", () => {
    expect(sanitizeTag("！！！")).toBeNull();
    expect(sanitizeTag("   ")).toBeNull();
  });
});

describe("parseGitRemote", () => {
  test("parses ssh, scp, and https remotes", () => {
    expect(parseGitRemote("git@github.com:whatasoda/agent-extensions.git")).toEqual({
      owner: "whatasoda",
      name: "agent-extensions",
    });
    expect(parseGitRemote("https://github.com/whatasoda/agent-extensions.git")).toEqual({
      owner: "whatasoda",
      name: "agent-extensions",
    });
    expect(parseGitRemote("ssh://git@github.com/whatasoda/agent-extensions")).toEqual({
      owner: "whatasoda",
      name: "agent-extensions",
    });
  });

  test("returns null when no owner/name pair is present", () => {
    expect(parseGitRemote("")).toBeNull();
    expect(parseGitRemote("origin")).toBeNull();
  });
});

describe("selectTurnsWithinBudget", () => {
  test("keeps the newest turns in chronological order", () => {
    const turns = [turn(1, "a".repeat(200)), turn(2, "b".repeat(200)), turn(3, "c".repeat(200))];
    const kept = selectTurnsWithinBudget(turns, 700);
    expect(kept.map((t) => t.turn)).toEqual([2, 3]);
  });

  test("keeps every turn when the budget is generous", () => {
    const turns = [turn(1, "a"), turn(2, "b")];
    expect(selectTurnsWithinBudget(turns, 100_000).map((t) => t.turn)).toEqual([1, 2]);
  });

  test("keeps the newest turn even when it alone exceeds the budget", () => {
    const turns = [turn(1, "a"), turn(2, "b".repeat(5_000))];
    expect(selectTurnsWithinBudget(turns, 100).map((t) => t.turn)).toEqual([2]);
  });
});

describe("parseCodexResult", () => {
  test("parses a plain JSON object", () => {
    const parsed = parseCodexResult(JSON.stringify(draft()));
    expect(parsed.slug).toBe("handoff-codex");
    expect(parsed.next_actions).toHaveLength(2);
  });

  test("parses JSON wrapped in a code fence", () => {
    const parsed = parseCodexResult(`\`\`\`json\n${JSON.stringify(draft())}\n\`\`\``);
    expect(parsed.title).toBe("Move handoff generation to Codex");
  });

  test("rejects an empty final message", () => {
    expect(() => parseCodexResult("  ")).toThrow(HandoffGenerationError);
  });

  test("rejects non-JSON output", () => {
    expect(() => parseCodexResult("I could not complete this task.")).toThrow(
      HandoffGenerationError,
    );
  });

  test("rejects a missing body", () => {
    const { body_markdown: _omitted, ...rest } = draft();
    expect(() => parseCodexResult(JSON.stringify(rest))).toThrow(/body_markdown/);
  });

  test("rejects an empty next_actions list", () => {
    expect(() => parseCodexResult(JSON.stringify(draft({ next_actions: [] })))).toThrow(
      /next_actions/,
    );
  });
});

describe("composeBody", () => {
  test("prepends the title when the body has no H1", () => {
    const body = composeBody(draft({ body_markdown: "## Next Actions\n\n- do it" }));
    expect(body.startsWith("# Move handoff generation to Codex")).toBe(true);
  });

  test("keeps an existing H1", () => {
    const body = composeBody(
      draft({ body_markdown: "# Existing title\n\n## Next Actions\n\n- do it" }),
    );
    expect(body.startsWith("# Existing title")).toBe(true);
    expect(body.match(/^# /gm)).toHaveLength(1);
  });

  test("appends Next Actions when the body omits the section", () => {
    const body = composeBody(draft({ body_markdown: "# Title\n\n## Work Done\n\n- something" }));
    expect(body).toContain("## Next Actions\n\n- Run bun run test\n- Publish the package");
  });

  test("does not duplicate an existing Next Actions section", () => {
    const body = composeBody(
      draft({ body_markdown: "# Title\n\n### Next Actions\n\n- already listed" }),
    );
    expect(body.match(/Next Actions/g)).toHaveLength(1);
  });

  test("appends unresolved blockers so the reader knows what is unverified", () => {
    const body = composeBody(draft({ body_markdown: "# Title\n\n## Next Actions\n\n- do it" }), [
      { severity: "blocker", issue: "cites a missing file", fix: "drop the reference" },
    ]);
    expect(body).toContain("## Unresolved review findings");
    expect(body).toContain("- cites a missing file");
    expect(body).toContain("suggested fix: drop the reference");
  });

  test("omits the unresolved section when the review cleared everything", () => {
    expect(composeBody(draft(), [])).not.toContain("Unresolved review findings");
  });
});

describe("buildPrompt", () => {
  const base = {
    repoRoot: "/repo",
    gitSnapshot: "- current branch: `main`",
    transcriptEvidence: '<transcript-turn number="1">hi</transcript-turn>',
    turnsUsed: 2,
    turnsTotal: 2,
  };

  test("pins the slug when one is supplied", () => {
    expect(buildPrompt({ ...base, slug: "fixed-slug" })).toContain("Use exactly `fixed-slug`");
  });

  test("asks Codex to derive the slug otherwise", () => {
    expect(buildPrompt(base)).toContain("Derive `slug`");
  });

  test("carries the scope hint", () => {
    expect(buildPrompt({ ...base, scope: "focus on the CLI" })).toContain("focus on the CLI");
  });

  test("declares whether the transcript was truncated", () => {
    expect(buildPrompt(base)).toContain("All 2 turns");
    expect(buildPrompt({ ...base, turnsUsed: 1 })).toContain("Only the most recent 1 of 2 turns");
  });

  test("marks the transcript as untrusted", () => {
    expect(buildPrompt(base)).toContain("untrusted data");
  });
});

describe("parseReviewResult", () => {
  const review = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      verdict: "accept",
      issues: [],
      notes: "checked every cited path",
      ...overrides,
    });

  test("parses an accepting review", () => {
    const parsed = parseReviewResult(review());
    expect(parsed.verdict).toBe("accept");
    expect(parsed.issues).toEqual([]);
  });

  test("parses issues with severities", () => {
    const parsed = parseReviewResult(
      review({
        verdict: "revise",
        issues: [
          { severity: "blocker", issue: "cites a missing file", fix: "drop the reference" },
          { severity: "improve", issue: "ordering is odd", fix: "reorder" },
        ],
      }),
    );
    expect(parsed.verdict).toBe("revise");
    expect(countBlockers(parsed.issues)).toBe(1);
  });

  test("rejects an unknown verdict", () => {
    expect(() => parseReviewResult(review({ verdict: "maybe" }))).toThrow(/verdict/);
  });

  test("rejects an unknown severity", () => {
    expect(() =>
      parseReviewResult(review({ issues: [{ severity: "critical", issue: "x", fix: "y" }] })),
    ).toThrow(/severity/);
  });

  test("rejects non-JSON reviewer output", () => {
    expect(() => parseReviewResult("looks fine to me")).toThrow(HandoffGenerationError);
  });
});

describe("buildReviewPrompt", () => {
  const base = {
    repoRoot: "/repo",
    draft: draft({ body_markdown: "# Title\n\n## Next Actions\n\n- run tests" }),
    gitSnapshot: "- current branch: `main`",
    transcriptEvidence: '<transcript-turn number="1">hi</transcript-turn>',
  };

  test("embeds the draft under review", () => {
    const prompt = buildReviewPrompt(base);
    expect(prompt).toContain("## Next Actions");
    expect(prompt).toContain("Move handoff generation to Codex");
  });

  test("defines what counts as a blocker and forbids rewriting", () => {
    const prompt = buildReviewPrompt(base);
    expect(prompt).toContain("`blocker`");
    expect(prompt).toContain("do not rewrite the document");
  });

  test("marks the draft and transcript as untrusted", () => {
    expect(buildReviewPrompt(base)).toContain("untrusted data");
  });
});

describe("buildRevisePrompt", () => {
  const base = {
    repoRoot: "/repo",
    draft: draft(),
    review: {
      verdict: "revise" as const,
      issues: [
        { severity: "blocker" as const, issue: "cites a missing file", fix: "drop the reference" },
      ],
      notes: "paths checked",
    },
    gitSnapshot: "- current branch: `main`",
    transcriptEvidence: '<transcript-turn number="1">hi</transcript-turn>',
  };

  test("lists every reviewer issue with its fix", () => {
    const prompt = buildRevisePrompt(base);
    expect(prompt).toContain("[blocker] cites a missing file");
    expect(prompt).toContain("fix: drop the reference");
  });

  test("asks for the full corrected document", () => {
    expect(buildRevisePrompt(base)).toContain("the full corrected");
  });

  test("pins the slug when one is supplied", () => {
    expect(buildRevisePrompt({ ...base, slug: "fixed-slug" })).toContain("Keep `fixed-slug`");
  });
});
