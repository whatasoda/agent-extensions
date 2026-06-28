import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanInsights, scanInsightsDataset } from "./scanner.js";

const temporaryDirectories: string[] = [];
const SINCE = new Date("2026-06-01T00:00:00.000Z");
const UNTIL = new Date("2026-07-01T00:00:00.000Z");

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "soda-insights-"));
  temporaryDirectories.push(root);
  return root;
}

function writeJsonl(filePath: string, entries: unknown[]): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function usage(outputTokens: number) {
  return {
    input_tokens: 10,
    cache_creation_input_tokens: 20,
    cache_read_input_tokens: 30,
    output_tokens: outputTokens,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("scanInsights", () => {
  it("deduplicates split messages and fork copies while retaining terminal usage", async () => {
    const root = temporaryRoot();
    const project = path.join(root, "project");
    const sessionId = "session-1";
    const timestamp = "2026-06-15T00:00:00.000Z";

    writeJsonl(path.join(project, `${sessionId}.jsonl`), [
      {
        type: "user",
        timestamp,
        entrypoint: "cli",
        promptSource: "typed",
        message: { content: "continue" },
      },
      {
        type: "assistant",
        timestamp,
        requestId: "request-1",
        message: {
          id: "message-1",
          model: "claude-opus",
          stop_reason: null,
          usage: usage(1),
          content: [{ type: "thinking", text: "not retained" }],
        },
      },
      {
        type: "assistant",
        timestamp,
        requestId: "request-1",
        message: {
          id: "message-1",
          model: "claude-opus",
          stop_reason: "tool_use",
          usage: { ...usage(10), iterations: [{ type: "message" }] },
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Skill",
              input: { skill: "soda:soda-handoff" },
            },
          ],
        },
      },
    ]);

    writeJsonl(path.join(project, sessionId, "subagents", "agent-child.jsonl"), [
      {
        type: "assistant",
        timestamp,
        requestId: "request-1",
        message: {
          id: "message-1",
          model: "claude-opus",
          stop_reason: "tool_use",
          usage: { ...usage(10), iterations: [{ type: "message" }] },
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Skill",
              input: { skill: "soda:soda-handoff" },
            },
          ],
        },
      },
      {
        type: "assistant",
        timestamp,
        requestId: "request-2",
        message: {
          id: "message-2",
          model: "claude-sonnet",
          stop_reason: "end_turn",
          usage: usage(5),
          content: [{ type: "text", text: "not retained" }],
        },
      },
    ]);

    const report = await scanInsights({ root, since: SINCE, until: UNTIL });

    expect(report.api.unique_calls).toBe(2);
    expect(report.api.usage.input_tokens).toBe(20);
    expect(report.api.usage.cache_creation_input_tokens).toBe(40);
    expect(report.api.usage.cache_read_input_tokens).toBe(60);
    expect(report.api.usage.output_tokens).toBe(15);
    expect(report.api.usage.context_processed_tokens).toBe(120);
    expect(report.api.ambiguous_actor_calls).toBe(1);
    expect(report.api.by_actor.root.calls).toBe(1);
    expect(report.api.by_actor.subagent.calls).toBe(1);
    expect(report.tools.unique_calls).toBe(1);
    expect(report.tools.skills["soda:soda-handoff"]).toBe(1);
    expect(report.sessions.by_cohort.human_interactive).toBe(1);
  });

  it("filters by entry timestamp rather than file modification time", async () => {
    const root = temporaryRoot();
    const filePath = path.join(root, "project", "session-2.jsonl");
    writeJsonl(filePath, [
      {
        type: "assistant",
        timestamp: "2026-06-20T00:00:00.000Z",
        requestId: "request-new",
        message: {
          id: "message-new",
          model: "claude-opus",
          stop_reason: "end_turn",
          usage: usage(3),
          content: [],
        },
      },
      {
        type: "assistant",
        timestamp: "2026-05-20T00:00:00.000Z",
        requestId: "request-old",
        message: {
          id: "message-old",
          model: "claude-opus",
          stop_reason: "end_turn",
          usage: usage(99),
          content: [],
        },
      },
    ]);
    const oldMtime = new Date("2025-01-01T00:00:00.000Z");
    utimesSync(filePath, oldMtime, oldMtime);

    const report = await scanInsights({ root, since: SINCE, until: UNTIL });

    expect(report.api.unique_calls).toBe(1);
    expect(report.api.usage.output_tokens).toBe(3);
    expect(report.source.files_with_period_entries).toBe(1);
  });

  it("classifies structured artifacts without retaining command text or secrets", async () => {
    const root = temporaryRoot();
    const timestamp = "2026-06-15T00:00:00.000Z";
    writeJsonl(path.join(root, "project", "session-3.jsonl"), [
      {
        type: "user",
        timestamp,
        entrypoint: "cli",
        promptSource: "typed",
        message: { content: "record the handoff" },
      },
      {
        type: "assistant",
        timestamp,
        requestId: "request-secret",
        message: {
          id: "message-secret",
          model: "claude-opus",
          stop_reason: "tool_use",
          usage: usage(2),
          content: [
            {
              type: "tool_use",
              id: "tool-secret",
              name: "Bash",
              input: {
                command:
                  "TOKEN=super-secret-value; cat <<'EOF' | sd handoff write --slug private --stdin\nsecret body\nEOF",
              },
            },
          ],
        },
      },
      {
        type: "pr-link",
        timestamp,
        prUrl: "https://example.invalid/pull/1",
      },
      {
        type: "user",
        timestamp,
        toolUseResult: { gitOperation: { type: "commit" } },
        message: { content: [] },
      },
    ]);

    const report = await scanInsights({ root, since: SINCE, until: UNTIL });
    const serialized = JSON.stringify(report);

    expect(report.artifacts.handoff_write).toBe(1);
    expect(report.artifacts.pr_links).toBe(1);
    expect(report.artifacts.git_commit).toBe(1);
    expect(report.privacy.raw_content_retained).toBeFalse();
    expect(report.privacy.command_text_retained).toBeFalse();
    expect(serialized).not.toContain("super-secret-value");
    expect(serialized).not.toContain("secret body");
    expect(serialized).not.toContain("private");
  });

  it("excludes conflicting copies from strict token totals", async () => {
    const root = temporaryRoot();
    const timestamp = "2026-06-15T00:00:00.000Z";
    writeJsonl(path.join(root, "project", "session-4.jsonl"), [
      {
        type: "assistant",
        timestamp,
        requestId: "request-conflict",
        message: {
          id: "message-conflict",
          model: "claude-opus",
          stop_reason: "end_turn",
          usage: usage(2),
          content: [],
        },
      },
      {
        type: "assistant",
        timestamp,
        requestId: "request-conflict",
        message: {
          id: "message-conflict",
          model: "claude-sonnet",
          stop_reason: "end_turn",
          usage: usage(2),
          content: [],
        },
      },
    ]);

    const report = await scanInsights({ root, since: SINCE, until: UNTIL });

    expect(report.api.unique_calls).toBe(0);
    expect(report.api.conflicting_calls).toBe(1);
    expect(report.api.usage.context_processed_tokens).toBe(0);
  });

  it("extracts only structured handoff references into the internal dataset", async () => {
    const root = temporaryRoot();
    const timestamp = "2026-06-15T00:00:00.000Z";
    const handoffId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    writeJsonl(path.join(root, "project", "session-5.jsonl"), [
      {
        type: "user",
        timestamp,
        entrypoint: "cli",
        promptSource: "typed",
        message: {
          content: `Read /Users/example/.soda-agent-tools/handoffs/${handoffId}.md and continue`,
        },
      },
      {
        type: "assistant",
        timestamp,
        requestId: "request-handoff",
        message: {
          id: "message-handoff",
          model: "claude-opus",
          stop_reason: "tool_use",
          usage: usage(2),
          content: [
            {
              type: "tool_use",
              id: "tool-handoff",
              name: "Bash",
              input: {
                command:
                  "cat <<'EOF' | sd handoff write --slug successor --stdin\nprivate body\nEOF",
              },
            },
          ],
        },
      },
    ]);

    const dataset = await scanInsightsDataset({ root, since: SINCE, until: UNTIL });
    const evidence = dataset.sessions[0].handoffs;

    expect(evidence).toContainEqual(
      expect.objectContaining({
        action: "reference",
        ref: handoffId,
        ref_type: "id",
        source: "user_path",
      }),
    );
    expect(evidence).toContainEqual(
      expect.objectContaining({
        action: "write",
        ref: "successor",
        ref_type: "slug",
        source: "sd_command",
      }),
    );
    expect(JSON.stringify(dataset)).not.toContain("private body");
  });
});
