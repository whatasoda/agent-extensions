#!/usr/bin/env bun
/**
 * Quantitative metrics calculator for skill-insights.
 *
 * Reads the raw JSON output from analyze.ts and computes session-level
 * and overall metrics for quality density, main context load, repeated
 * commands, and unused skills.
 *
 * Usage:
 *   bun metrics.ts --input /tmp/skill-insights-raw.json --output /tmp/skill-insights-metrics.json
 */

import type {
  MetricsOutput,
  OverallMetrics,
  RawModeOutput,
  RawSession,
  RepeatedCommand,
  SessionMetrics,
} from "./types.ts"

function computeSessionMetrics(session: RawSession): SessionMetrics {
  const turns = session.turns ?? []
  const metadata = session.metadata
  const numTurns = turns.length

  if (numTurns === 0) {
    return {
      date: session.date ?? "",
      num_turns: 0,
      subagent_count: 0,
      skill_count: 0,
      clear_count: 0,
      quality_density_pct: 0.0,
      main_bash_count: 0,
      total_bash_count: 0,
      main_bash_ratio_pct: 0.0,
      main_heavy_tool_count: 0,
      slash_command_count: 0,
      mcp_tool_count: 0,
      repeated_commands: [],
      auto_compact_count: 0,
      manual_compact_count: 0,
      fork_count: 0,
      rewind_count: 0,
    }
  }

  // Count SubAgent launches and Skill uses from turns
  const subagentCount = turns.reduce((sum, t) => sum + (t.subagents?.length ?? 0), 0)
  const skillCount = turns.reduce((sum, t) => sum + (t.skills?.length ?? 0), 0)
  const clearCount = metadata?.clear_count ?? 0

  // Quality Density = (SubAgent + Skill + SlashCommand + MCP) / turns * 100
  // Note: /clear is already included in slashCommandCount via slash_commands array,
  // so clearCount is not added separately to avoid double-counting.
  const slashCommandCount = (metadata?.slash_commands ?? []).length
  const mcpToolCount = Object.entries(metadata?.main_tool_counts ?? {})
    .filter(([tool]) => tool.startsWith("mcp__"))
    .reduce((sum, [, count]) => sum + count, 0)
  const qualityDensity = ((subagentCount + skillCount + slashCommandCount + mcpToolCount) / numTurns) * 100

  // Main context Bash count vs total Bash
  const mainToolCounts = metadata?.main_tool_counts ?? {}
  const subagentToolCounts = metadata?.subagent_tool_counts ?? {}
  const mainBash = mainToolCounts.Bash ?? 0
  const subagentBash = subagentToolCounts.Bash ?? 0
  const totalBash = mainBash + subagentBash
  const mainBashRatio = totalBash > 0 ? (mainBash / totalBash) * 100 : 0.0

  // Main heavy tool count (Bash + Read + Grep + Glob in main context)
  const heavyTools = ["Bash", "Read", "Grep", "Glob"]
  const mainHeavy = heavyTools.reduce((sum, t) => sum + (mainToolCounts[t] ?? 0), 0)

  // Repeated commands detection (same Bash command 3+ times)
  const bashCommands = metadata?.main_bash_commands ?? []
  const cmdCounter = new Map<string, number>()
  for (const cmd of bashCommands) {
    const normalized = cmd.trim().slice(0, 100)
    if (normalized) {
      cmdCounter.set(normalized, (cmdCounter.get(normalized) ?? 0) + 1)
    }
  }
  const repeatedCommands: RepeatedCommand[] = Array.from(cmdCounter.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([command, count]) => ({ command: command.slice(0, 100), count }))

  // Context management command counts from slash_commands
  const slashCmds = metadata?.slash_commands ?? []
  const manualCompactCount = slashCmds.filter((cmd) => cmd === "/compact").length
  const forkCount = slashCmds.filter((cmd) => cmd === "/fork").length
  const rewindCount = slashCmds.filter((cmd) => cmd === "/rewind").length
  const autoCompactCount = metadata?.auto_compact_count ?? 0

  return {
    date: session.date ?? "",
    num_turns: numTurns,
    subagent_count: subagentCount,
    skill_count: skillCount,
    clear_count: clearCount,
    quality_density_pct: Math.round(qualityDensity * 10) / 10,
    main_bash_count: mainBash,
    total_bash_count: totalBash,
    main_bash_ratio_pct: Math.round(mainBashRatio * 10) / 10,
    main_heavy_tool_count: mainHeavy,
    slash_command_count: slashCommandCount,
    mcp_tool_count: mcpToolCount,
    repeated_commands: repeatedCommands,
    auto_compact_count: autoCompactCount,
    manual_compact_count: manualCompactCount,
    fork_count: forkCount,
    rewind_count: rewindCount,
  }
}

function computeOverallMetrics(
  sessionMetrics: SessionMetrics[],
  existingSkills: string[],
  usedSkills: Set<string>,
  existingAgentNames: string[],
  usedAgentTypes: Set<string>,
): OverallMetrics {
  const totalTurns = sessionMetrics.reduce((s, m) => s + m.num_turns, 0)
  const totalSubagent = sessionMetrics.reduce((s, m) => s + m.subagent_count, 0)
  const totalSkill = sessionMetrics.reduce((s, m) => s + m.skill_count, 0)
  const totalClear = sessionMetrics.reduce((s, m) => s + m.clear_count, 0)
  const totalSlashCommands = sessionMetrics.reduce((s, m) => s + m.slash_command_count, 0)
  const totalMcpTools = sessionMetrics.reduce((s, m) => s + m.mcp_tool_count, 0)

  const overallDensity =
    totalTurns > 0
      ? ((totalSubagent + totalSkill + totalSlashCommands + totalMcpTools) / totalTurns) * 100
      : 0.0

  const totalMainBash = sessionMetrics.reduce((s, m) => s + m.main_bash_count, 0)
  const totalBash = sessionMetrics.reduce((s, m) => s + m.total_bash_count, 0)
  const overallBashRatio = totalBash > 0 ? (totalMainBash / totalBash) * 100 : 0.0

  // All repeated commands across sessions
  const allRepeated: RepeatedCommand[] = []
  for (const m of sessionMetrics) {
    allRepeated.push(...m.repeated_commands)
  }

  // Unused skills
  const unused = existingSkills.filter((s) => !usedSkills.has(s)).sort()

  // Unused agents
  const unusedAgents = existingAgentNames.filter((a) => !usedAgentTypes.has(a)).sort()

  // Context management aggregates
  const totalAutoCompact = sessionMetrics.reduce((s, m) => s + m.auto_compact_count, 0)
  const totalManualCompact = sessionMetrics.reduce((s, m) => s + m.manual_compact_count, 0)
  const totalFork = sessionMetrics.reduce((s, m) => s + m.fork_count, 0)
  const totalRewind = sessionMetrics.reduce((s, m) => s + m.rewind_count, 0)
  const sessionsWithZeroAutoCompact = sessionMetrics.filter((m) => m.auto_compact_count === 0).length
  const autoCompactZeroRate =
    sessionMetrics.length > 0 ? (sessionsWithZeroAutoCompact / sessionMetrics.length) * 100 : 100.0

  return {
    total_turns: totalTurns,
    total_subagent: totalSubagent,
    total_skill: totalSkill,
    total_clear: totalClear,
    overall_quality_density_pct: Math.round(overallDensity * 10) / 10,
    total_main_bash: totalMainBash,
    total_bash: totalBash,
    overall_main_bash_ratio_pct: Math.round(overallBashRatio * 10) / 10,
    total_slash_commands: totalSlashCommands,
    total_mcp_tools: totalMcpTools,
    all_repeated_commands: allRepeated,
    unused_skills: unused,
    unused_agents: unusedAgents,
    total_auto_compact: totalAutoCompact,
    total_manual_compact: totalManualCompact,
    total_fork: totalFork,
    total_rewind: totalRewind,
    auto_compact_zero_rate_pct: Math.round(autoCompactZeroRate * 10) / 10,
  }
}

// --- CLI Entry Point ---

function parseArgs(): { input: string; output: string | null } {
  const args = process.argv.slice(2)
  let input = ""
  let output: string | null = null

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input":
        input = args[++i] ?? ""
        break
      case "--output":
        output = args[++i] ?? null
        break
    }
  }

  if (!input) {
    console.error("Error: --input is required")
    process.exit(1)
  }

  return { input, output }
}

async function main() {
  const { input, output } = parseArgs()

  const rawData: RawModeOutput = JSON.parse(await Bun.file(input).text())

  const sessions = rawData.sessions ?? []
  const existingSkills = rawData.existing_skills ?? []

  // Collect all used skills across sessions
  const usedSkills = new Set<string>()
  for (const session of sessions) {
    for (const turn of session.turns ?? []) {
      for (const s of turn.skills ?? []) {
        usedSkills.add(s)
      }
    }
  }

  // Collect all used agent types across sessions
  const usedAgentTypes = new Set<string>()
  for (const session of sessions) {
    for (const turn of session.turns ?? []) {
      for (const a of turn.subagents ?? []) {
        usedAgentTypes.add(a)
      }
    }
    for (const launch of session.metadata?.subagent_launches ?? []) {
      if (launch.type) usedAgentTypes.add(launch.type)
    }
  }

  // Compute per-session metrics
  const sessionMetrics: SessionMetrics[] = []
  for (const session of sessions) {
    const metrics = computeSessionMetrics(session)
    sessionMetrics.push(metrics)
  }

  // Compute overall metrics
  const existingAgentNames = (rawData.existing_agents ?? []).map((a: { name: string }) => a.name)
  const overall = computeOverallMetrics(sessionMetrics, existingSkills, usedSkills, existingAgentNames, usedAgentTypes)

  const result: MetricsOutput = {
    session_metrics: sessionMetrics,
    overall,
  }

  const outputJson = JSON.stringify(result, null, 2)

  if (output) {
    await Bun.write(output, outputJson)
    console.log(JSON.stringify({ status: "ok", output }))
  } else {
    console.log(outputJson)
  }
}

main()
