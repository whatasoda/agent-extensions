import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Database } from "../core/database.js";
import type { InsightsDataset, SessionInsight, TokenSummary } from "./types.js";
import { resolveWorkstreams } from "./workstreams.js";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "soda-workstreams-"));
  temporaryDirectories.push(directory);
  return directory;
}

function usage(context: number): TokenSummary {
  return {
    input_tokens: 10,
    cache_creation_input_tokens: 20,
    cache_read_input_tokens: context - 30,
    output_tokens: 5,
    context_processed_tokens: context,
  };
}

function session(sessionId: string, predecessorId: string, successorSlug: string): SessionInsight {
  return {
    session_id: sessionId,
    cohort: "human_interactive",
    first_timestamp: "2026-06-15T00:00:00.000Z",
    last_timestamp: "2026-06-15T01:00:00.000Z",
    api: {
      calls: 2,
      root: { calls: 1, usage: usage(60) },
      subagent: { calls: 1, usage: usage(40) },
      total: usage(100),
    },
    handoffs: [
      {
        action: "reference",
        ref: predecessorId,
        ref_type: "id",
        source: "user_path",
        timestamp: "2026-06-15T00:00:00.000Z",
      },
      {
        action: "write",
        ref: successorSlug,
        ref_type: "slug",
        source: "sd_command",
        timestamp: "2026-06-15T01:00:00.000Z",
      },
    ],
    artifacts: {
      git_commit: 1,
      git_pr: 0,
      git_push: 0,
      handoff_complete: 0,
      handoff_get: 0,
      handoff_write: 1,
      pr_links: 1,
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("resolveWorkstreams", () => {
  it("connects an explicitly resumed handoff to the successor written in the same session", () => {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, "data.db");
    const db = new Database(dbPath);
    const predecessor = db.createNode({
      kind: "handoff",
      body: "# predecessor",
      properties: { slug: "predecessor", status: "active" },
      tags: ["topic:confirmed"],
    });
    const successor = db.createNode({
      kind: "handoff",
      body: "# successor",
      properties: { slug: "successor", status: "active" },
      tags: ["topic:confirmed"],
    });
    db.close();

    const dataset = {
      report: {
        period: {
          since: "2026-06-01T00:00:00.000Z",
          until: "2026-07-01T00:00:00.000Z",
        },
      },
      sessions: [session("session-1", predecessor.id, "successor")],
    } as InsightsDataset;

    const report = resolveWorkstreams(dataset, dbPath);

    expect(report.summary.confirmed_workstreams).toBe(1);
    expect(report.summary.connected_handoffs).toBe(2);
    expect(report.summary.linked_sessions).toBe(1);
    expect(report.workstreams[0].handoff_count).toBe(2);
    expect(report.workstreams[0].session_count).toBe(1);
    expect(report.workstreams[0].shared_session_count).toBe(0);
    expect(report.workstreams[0].evidence.session_transitions).toBe(1);
    expect(report.workstreams[0].api.total.context_processed_tokens).toBe(100);
    expect(report.workstreams[0].api.subagent_context_share_pct).toBe(40);
    expect(report.workstreams[0].artifacts.git_commit).toBe(1);
    expect(report.workstreams[0].latest_handoffs.map((item) => item.id)).toContain(successor.id);
  });

  it("reports shared topic tags as candidates without merging components", () => {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, "data.db");
    const db = new Database(dbPath);
    const first = db.createNode({
      kind: "handoff",
      properties: { slug: "first", status: "active" },
      tags: ["topic:candidate"],
    });
    db.createNode({
      kind: "handoff",
      properties: { slug: "second", status: "active" },
      tags: ["topic:candidate"],
    });
    db.close();

    const dataset = {
      report: {
        period: {
          since: "2026-06-01T00:00:00.000Z",
          until: "2026-07-01T00:00:00.000Z",
        },
      },
      sessions: [session("session-2", first.id, "first")],
    } as InsightsDataset;

    const report = resolveWorkstreams(dataset, dbPath);

    expect(report.summary.confirmed_workstreams).toBe(0);
    expect(report.candidate_topic_groups).toContainEqual({
      tag: "topic:candidate",
      handoff_count: 2,
      confirmed_component_count: 2,
    });
  });

  it("links a write only to the most recently referenced handoff", () => {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, "data.db");
    const db = new Database(dbPath);
    const first = db.createNode({
      kind: "handoff",
      properties: { slug: "first-context", status: "active" },
    });
    const second = db.createNode({
      kind: "handoff",
      properties: { slug: "second-context", status: "active" },
    });
    db.createNode({
      kind: "handoff",
      properties: { slug: "successor-context", status: "active" },
    });
    db.close();

    const value = session("session-3", first.id, "successor-context");
    value.handoffs.splice(1, 0, {
      action: "reference",
      ref: second.id,
      ref_type: "id",
      source: "user_path",
      timestamp: "2026-06-15T00:30:00.000Z",
    });
    const dataset = {
      report: {
        period: {
          since: "2026-06-01T00:00:00.000Z",
          until: "2026-07-01T00:00:00.000Z",
        },
      },
      sessions: [value],
    } as InsightsDataset;

    const report = resolveWorkstreams(dataset, dbPath);

    expect(report.summary.confirmed_workstreams).toBe(1);
    expect(report.workstreams[0].handoff_count).toBe(2);
    expect(report.workstreams[0].latest_handoffs.map((item) => item.id)).not.toContain(first.id);
  });
});
