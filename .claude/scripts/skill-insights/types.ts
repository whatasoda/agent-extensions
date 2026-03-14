// ============================================================
// JSONL Entry Types
// ============================================================

export type ContentItem = { type: string; [k: string]: unknown }

export interface JsonlEntry {
  type: string
  subtype?: string
  message?: { content: string | ContentItem[]; [k: string]: unknown }
  isSidechain?: boolean
  snapshot?: { timestamp?: string; [k: string]: unknown }
  compactMetadata?: {
    trigger?: string
    preTokens?: number
    [k: string]: unknown
  }
  timestamp?: string
  summary?: string
  toolUseResult?: { stdout?: string; [k: string]: unknown }
  [k: string]: unknown
}

// ============================================================
// Build Result Types
// ============================================================

export interface Turn {
  human: string
  ai: string
  tools: string[]
  skills: string[]
  subagents: string[]
}

export interface AssistantContent {
  texts: string[]
  tools: string[]
  skills: string[]
  subagents: string[]
}

export interface SubagentLaunch {
  type: string
  description: string
}

export interface ExistingAgent {
  name: string
  source: "user" | "project" | "plugin"
  pluginName?: string
  filePath: string
}

// ============================================================
// Session Metadata
// ============================================================

export interface SessionMetadata {
  auto_compact_count: number
  compact_timestamps: string[]
  compact_pre_tokens: number[]
  clear_count: number
  slash_commands: string[]
  total_entries: number
  main_tool_counts: Record<string, number>
  subagent_tool_counts: Record<string, number>
  subagent_launches: SubagentLaunch[]
  session_summaries: string[]
  main_bash_commands: string[]
}

// ============================================================
// Raw Mode Output
// ============================================================

export interface RawSession {
  date: string
  file: string
  project: string
  turns: Turn[]
  metadata: SessionMetadata
}

export interface RawModeOutput {
  meta: {
    mode: "raw"
    project_count: number
    session_count: number
    days: number
    date_range: { from: string; to: string }
    total_human_turns: number
    total_auto_compacts: number
    total_clears: number
    total_subagent_launches: number
    sessions_with_compacts: number
    long_sessions_count: number
    analyzed_at: string
  }
  sessions: RawSession[]
  existing_skills: string[]
  existing_commands: string[]
  existing_agents: ExistingAgent[]
}

// ============================================================
// Batch Output Types (for SubAgent-friendly file splitting)
// ============================================================

/** Session summary in the index file (no turns — lightweight) */
export interface SessionIndexEntry {
  date: string
  project: string
  num_turns: number
  auto_compact_count: number
  batch_file: string
}

/** Index file: lightweight overview that fits within Read tool's 2,000-line limit */
export interface RawIndexOutput {
  meta: RawModeOutput["meta"]
  existing_skills: string[]
  existing_commands: string[]
  existing_agents: ExistingAgent[]
  session_files: string[]
  session_index: SessionIndexEntry[]
}

/** Batch file: a subset of sessions with full turns data */
export interface SessionBatchOutput {
  batch_number: number
  total_batches: number
  sessions: RawSession[]
}

// ============================================================
// Metrics Types
// ============================================================

export interface RepeatedCommand {
  command: string
  count: number
}

export interface SessionMetrics {
  date: string
  project: string
  file: string
  num_turns: number
  subagent_count: number
  skill_count: number
  clear_count: number
  quality_density_pct: number
  main_bash_count: number
  total_bash_count: number
  main_bash_ratio_pct: number
  main_heavy_tool_count: number
  slash_command_count: number
  mcp_tool_count: number
  repeated_commands: RepeatedCommand[]
  // Context management metrics
  auto_compact_count: number
  manual_compact_count: number
  fork_count: number
  rewind_count: number
}

export interface OverallMetrics {
  total_turns: number
  total_subagent: number
  total_skill: number
  total_clear: number
  overall_quality_density_pct: number
  total_main_bash: number
  total_bash: number
  overall_main_bash_ratio_pct: number
  total_slash_commands: number
  total_mcp_tools: number
  all_repeated_commands: RepeatedCommand[]
  unused_skills: string[]
  unused_agents: string[]
  // Context management aggregates
  total_auto_compact: number
  total_manual_compact: number
  total_fork: number
  total_rewind: number
  auto_compact_zero_rate_pct: number
}

export interface MetricsOutput {
  session_metrics: SessionMetrics[]
  overall: OverallMetrics
}
