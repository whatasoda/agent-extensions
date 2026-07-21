import os from "node:os";
import path from "node:path";
import { scanInsightsDataset } from "../../insights/scanner.js";
import type { WorkstreamSummary } from "../../insights/workstreams.js";
import { resolveWorkstreams } from "../../insights/workstreams.js";
import { exitWithError, parseCli } from "../helpers.js";

function compactWorkstream(workstream: WorkstreamSummary) {
  const context = workstream.api.total.context_processed_tokens;
  return {
    workstream_id: workstream.workstream_id,
    handoff_count: workstream.handoff_count,
    session_count: workstream.session_count,
    shared_session_count: workstream.shared_session_count,
    status_counts: workstream.status_counts,
    repos: workstream.repos,
    first_created_at: workstream.first_created_at,
    last_updated_at: workstream.last_updated_at,
    api: {
      calls: workstream.api.calls,
      context_processed_tokens: context,
      output_tokens: workstream.api.total.output_tokens,
      context_per_session:
        workstream.session_count > 0 ? Math.round(context / workstream.session_count) : 0,
      cache_read_share_pct:
        context > 0
          ? Math.round((workstream.api.total.cache_read_input_tokens / context) * 1_000) / 10
          : 0,
      subagent_context_share_pct: workstream.api.subagent_context_share_pct,
    },
    artifacts: workstream.artifacts,
    evidence: workstream.evidence,
    latest_handoff: workstream.latest_handoffs[0] ?? null,
  };
}

export async function handleInsights(args: string[]): Promise<void> {
  const [action, ...rest] = args;
  if (action !== "analyze" && action !== "workstreams") {
    exitWithError(
      "Usage: sd insights <analyze|workstreams> [--days N | --since ISO] [--until ISO] [--root PATH] [--pretty] [--detail]",
    );
  }

  const { values } = parseCli(rest, {
    db: { type: "string" },
    days: { type: "string", default: "7" },
    detail: { type: "boolean", default: false },
    limit: { type: "string", default: "10" },
    "min-handoffs": { type: "string", default: "2" },
    since: { type: "string" },
    until: { type: "string" },
    root: { type: "string" },
    pretty: { type: "boolean", default: false },
  });

  const until = values.until ? new Date(values.until as string) : new Date();
  const days = Number(values.days);
  if (!Number.isFinite(days) || days <= 0) {
    exitWithError("Error: --days must be a positive number");
  }
  const since = values.since
    ? new Date(values.since as string)
    : new Date(until.getTime() - days * 86_400_000);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    exitWithError("Error: --since and --until must be valid dates");
  }

  const root = path.resolve(
    (values.root as string | undefined) ??
      path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"), "projects"),
  );

  try {
    const dataset = await scanInsightsDataset({ root, since, until });
    if (action === "analyze") {
      console.log(JSON.stringify(dataset.report, null, values.pretty ? 2 : undefined));
      return;
    }

    const minimumHandoffs = Number(values["min-handoffs"]);
    if (!Number.isInteger(minimumHandoffs) || minimumHandoffs < 2) {
      exitWithError("Error: --min-handoffs must be an integer of 2 or greater");
    }
    const dbPath = path.resolve(
      (values.db as string | undefined) ??
        process.env.SODA_AGENT_TOOLS_DB ??
        path.join(os.homedir(), ".soda-agent-tools", "data.db"),
    );
    const report = resolveWorkstreams(dataset, dbPath, minimumHandoffs);
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      exitWithError("Error: --limit must be a positive integer");
    }
    const selectedWorkstreams = report.workstreams.slice(0, limit);
    const limitedReport = {
      ...report,
      view: values.detail ? "detail" : "summary",
      summary: {
        ...report.summary,
        returned_workstreams: selectedWorkstreams.length,
      },
      workstreams: values.detail ? selectedWorkstreams : selectedWorkstreams.map(compactWorkstream),
      candidate_topic_groups: report.candidate_topic_groups.slice(0, limit),
    };
    console.log(JSON.stringify(limitedReport, null, values.pretty ? 2 : undefined));
  } catch (error) {
    exitWithError(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
