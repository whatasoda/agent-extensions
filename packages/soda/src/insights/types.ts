export interface TokenUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

export interface TokenSummary extends TokenUsage {
  context_processed_tokens: number;
}

export type SessionCohort =
  | "human_interactive"
  | "sdk_automation"
  | "scheduled_or_queued"
  | "background"
  | "unknown";

export interface BreakdownRow {
  calls: number;
  usage: TokenSummary;
}

export interface ArtifactCounts {
  handoff_write: number;
  handoff_get: number;
  handoff_complete: number;
  pr_links: number;
  git_commit: number;
  git_push: number;
  git_pr: number;
}

export interface HandoffEvidence {
  action: "reference" | "write" | "get" | "complete";
  ref: string;
  ref_type: "id" | "slug";
  source: "user_path" | "read_path" | "sd_command";
  timestamp: string;
}

export interface SessionInsight {
  session_id: string;
  cohort: SessionCohort;
  first_timestamp: string;
  last_timestamp: string;
  api: {
    calls: number;
    root: BreakdownRow;
    subagent: BreakdownRow;
    total: TokenSummary;
  };
  handoffs: HandoffEvidence[];
  artifacts: ArtifactCounts;
}

export interface InsightsDataset {
  report: InsightsReport;
  sessions: SessionInsight[];
}

export interface InsightsReport {
  schema_version: 1;
  period: {
    since: string;
    until: string;
  };
  source: {
    files_scanned: number;
    files_with_period_entries: number;
    malformed_lines: number;
  };
  sessions: {
    total: number;
    by_cohort: Record<string, number>;
  };
  api: {
    unique_calls: number;
    conflicting_calls: number;
    ambiguous_actor_calls: number;
    usage: TokenSummary;
    context_per_call: {
      p50: number;
      p90: number;
      p99: number;
    };
    by_model: Record<string, BreakdownRow>;
    by_actor: Record<string, BreakdownRow>;
    by_cohort: Record<string, BreakdownRow>;
  };
  tools: {
    unique_calls: number;
    by_name: Record<string, number>;
    skills: Record<string, number>;
    agent_launches: Record<string, number>;
  };
  artifacts: ArtifactCounts;
  privacy: {
    raw_content_retained: false;
    command_text_retained: false;
  };
}
