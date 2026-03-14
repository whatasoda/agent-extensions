#!/usr/bin/env bun

/**
 * Claude Code session log analyzer v5 (TypeScript/Bun port).
 *
 * Scans all project session directories under ~/.claude/projects/
 * and extracts raw conversation turns for AI-powered analysis.
 *
 * Usage:
 *   bun analyze.ts --days 3
 *   bun analyze.ts --days 7 --output /tmp/output.json
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { basename, join } from "node:path"
import type {
  AssistantContent,
  ContentItem,
  ExistingAgent,
  JsonlEntry,
  RawIndexOutput,
  RawModeOutput,
  RawSession,
  SessionBatchOutput,
  SessionIndexEntry,
  SessionMetadata,
  SubagentLaunch,
  Turn,
} from "./types.ts"

// ============================================================
// Constants
// ============================================================

const SYSTEM_PATTERNS: RegExp[] = [
  /^<system-reminder>/,
  /^<local-command-/,
  /^<command-name>/,
  /^<command-message>/,
  /^<command-args>/,
  /^<task-notification>/,
  /^<local-command-stdout>/,
  /^<local-command-caveat>/,
  /^\[Request interrupted/,
  /^Base directory for this skill:/,
  /^Use the Notion Workspace Skill/,
  /^Use the .+ MCP server/,
]

// ============================================================
// Helper utilities
// ============================================================

function counterIncrement(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function counterMostCommon(map: Map<string, number>, n: number): Record<string, number> {
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  const result: Record<string, number> = {}
  for (const [key, value] of sorted.slice(0, n)) result[key] = value
  return result
}

function isDir(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}

// ============================================================
// Shared utilities
// ============================================================

function getAllSessionsDirs(): Array<{ sessionsDir: string; shortName: string }> {
  const home = homedir()
  const claudeProjects = join(home, ".claude", "projects")
  if (!isDir(claudeProjects)) {
    return []
  }
  const results: Array<{ sessionsDir: string; shortName: string }> = []
  for (const entry of readdirSync(claudeProjects)) {
    const entryPath = join(claudeProjects, entry)
    if (!isDir(entryPath)) continue
    const hasJsonl = readdirSync(entryPath).some((f) => f.endsWith(".jsonl"))
    if (!hasJsonl) continue
    results.push({
      sessionsDir: entryPath,
      shortName: sessionsDirNameToShortName(entry),
    })
  }
  return results
}

function sessionsDirNameToShortName(dirName: string): string {
  const home = homedir()
  const homePrefix = home.replace(/[/.]/g, "-")
  let name = dirName
  if (name.startsWith(homePrefix)) {
    name = name.slice(homePrefix.length)
  }
  name = name.replace(/^-+/, "")
  name = name.replace(/^Desktop-/, "")
  if (!name) {
    return "(root)"
  }
  return name
}

function parseJsonlFile(filepath: string): JsonlEntry[] {
  const results: JsonlEntry[] = []
  try {
    const content = readFileSync(filepath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        results.push(JSON.parse(trimmed))
      } catch {}
    }
  } catch {
    // OSError equivalent — return empty
  }
  return results
}

function isRealHumanMessage(text: string): boolean {
  if (!text || text.trim().length < 3) {
    return false
  }
  const stripped = text.trim()
  for (const pattern of SYSTEM_PATTERNS) {
    if (pattern.test(stripped)) {
      return false
    }
  }
  return true
}

function extractHumanTexts(content: string | ContentItem[]): string[] {
  const texts: string[] = []
  if (typeof content === "string") {
    if (isRealHumanMessage(content)) {
      texts.push(content.trim())
    }
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item !== "object" || item === null) continue
      if ((item as ContentItem).type === "tool_result") continue
      if ((item as ContentItem).type === "text") {
        const text = (((item as Record<string, unknown>).text as string) ?? "").trim()
        if (isRealHumanMessage(text)) {
          texts.push(text)
        }
      }
    }
  }
  return texts
}

function extractAssistantContent(content: ContentItem[]): AssistantContent {
  const result: AssistantContent = { texts: [], tools: [], skills: [], subagents: [] }
  if (!Array.isArray(content)) {
    return result
  }
  for (const item of content) {
    if (typeof item !== "object" || item === null) continue
    const itemType = (item as Record<string, unknown>).type ?? ""
    if (itemType === "text") {
      const text = (((item as Record<string, unknown>).text as string) ?? "").trim()
      if (text && text.length > 2) {
        result.texts.push(text)
      }
    } else if (itemType === "tool_use") {
      const name = ((item as Record<string, unknown>).name as string) ?? "unknown"
      result.tools.push(name)
      const inp = ((item as Record<string, unknown>).input as Record<string, unknown>) ?? {}
      if (name === "Skill") {
        result.skills.push((inp.skill as string) ?? "unknown")
      } else if (name === "Agent" || name === "Task") {
        result.subagents.push((inp.subagent_type as string) ?? "unknown")
      }
    }
  }
  return result
}

function findExistingSkillsAndCommands(projectDir: string): { existing_skills: string[]; existing_commands: string[] } {
  const home = homedir()
  const skills: string[] = []
  const commands: string[] = []

  // 1. User-level skills: ~/.claude/skills/
  const skillsDir = join(home, ".claude", "skills")
  if (isDir(skillsDir)) {
    for (const e of readdirSync(skillsDir)) {
      if (isDir(join(skillsDir, e)) && !e.startsWith(".")) {
        skills.push(e)
      }
    }
  }

  // 2. Project-level skills: {project}/.claude/skills/
  const projectSkills = join(projectDir, ".claude", "skills")
  if (isDir(projectSkills)) {
    for (const e of readdirSync(projectSkills)) {
      if (isDir(join(projectSkills, e)) && !e.startsWith(".")) {
        if (!skills.includes(e)) {
          skills.push(e)
        }
      }
    }
  }

  // 3. Plugin skills & commands: ~/.claude/plugins/installed_plugins.json
  const installedPluginsPath = join(home, ".claude", "plugins", "installed_plugins.json")
  if (isFile(installedPluginsPath)) {
    try {
      const pluginsData = JSON.parse(readFileSync(installedPluginsPath, "utf-8"))
      const plugins = ((pluginsData as Record<string, unknown>).plugins as Record<string, unknown[]>) ?? {}
      for (const [pluginKey, installs] of Object.entries(plugins)) {
        const pluginName = pluginKey.split("@")[0]
        for (const installInfo of installs as Array<Record<string, unknown>>) {
          const installPath = (installInfo.installPath as string) ?? ""
          if (!installPath || !isDir(installPath)) continue
          // Plugin skills
          const pluginSkillsDir = join(installPath, "skills")
          if (isDir(pluginSkillsDir)) {
            for (const e of readdirSync(pluginSkillsDir)) {
              const skillDir = join(pluginSkillsDir, e)
              if (isDir(skillDir) && !e.startsWith(".")) {
                const fullName = `${pluginName}:${e}`
                if (!skills.includes(fullName)) {
                  skills.push(fullName)
                }
              }
            }
          }
          // Plugin commands
          const pluginCmdsDir = join(installPath, "commands")
          if (isDir(pluginCmdsDir)) {
            for (const e of readdirSync(pluginCmdsDir)) {
              if (e.endsWith(".md") && !e.startsWith(".")) {
                const cmdName = `${pluginName}:${e.replace(".md", "")}`
                if (!commands.includes(cmdName)) {
                  commands.push(cmdName)
                }
              }
            }
          }
        }
      }
    } catch {
      // JSONDecodeError / OSError equivalent
    }
  }

  // 4. User-level commands: ~/.claude/commands/
  const commandsDir = join(home, ".claude", "commands")
  if (isDir(commandsDir)) {
    for (const e of readdirSync(commandsDir)) {
      if (e.endsWith(".md") && !e.startsWith(".")) {
        commands.push(e.replace(".md", ""))
      }
    }
  }

  // 5. Project-level commands: {project}/.claude/commands/
  const projectCmds = join(projectDir, ".claude", "commands")
  if (isDir(projectCmds)) {
    for (const e of readdirSync(projectCmds)) {
      if (e.endsWith(".md") && !e.startsWith(".")) {
        const name = e.replace(".md", "")
        if (!commands.includes(name)) {
          commands.push(name)
        }
      }
    }
  }

  return {
    existing_skills: skills.sort(),
    existing_commands: commands.sort(),
  }
}

function findExistingAgents(projectDir: string): ExistingAgent[] {
  const home = homedir()
  const agents: ExistingAgent[] = []
  const seenNames = new Set<string>()

  // 1. User-level agents: ~/.claude/agents/
  const userAgentsDir = join(home, ".claude", "agents")
  if (isDir(userAgentsDir)) {
    for (const e of readdirSync(userAgentsDir)) {
      if (e.endsWith(".md") && !e.startsWith(".")) {
        const name = e.replace(".md", "")
        if (!seenNames.has(name)) {
          seenNames.add(name)
          agents.push({ name, source: "user", filePath: join(userAgentsDir, e) })
        }
      }
    }
  }

  // 2. Project-level agents: {project}/.claude/agents/
  const projectAgentsDir = join(projectDir, ".claude", "agents")
  if (isDir(projectAgentsDir)) {
    for (const e of readdirSync(projectAgentsDir)) {
      if (e.endsWith(".md") && !e.startsWith(".")) {
        const name = e.replace(".md", "")
        if (!seenNames.has(name)) {
          seenNames.add(name)
          agents.push({ name, source: "project", filePath: join(projectAgentsDir, e) })
        }
      }
    }
  }

  // 3. Plugin agents: ~/.claude/plugins/installed_plugins.json
  const installedPluginsPath = join(home, ".claude", "plugins", "installed_plugins.json")
  if (isFile(installedPluginsPath)) {
    try {
      const pluginsData = JSON.parse(readFileSync(installedPluginsPath, "utf-8"))
      const plugins = ((pluginsData as Record<string, unknown>).plugins as Record<string, unknown[]>) ?? {}
      for (const [pluginKey, installs] of Object.entries(plugins)) {
        const pluginName = pluginKey.split("@")[0]
        for (const installInfo of installs as Array<Record<string, unknown>>) {
          const installPath = (installInfo.installPath as string) ?? ""
          if (!installPath || !isDir(installPath)) continue
          const pluginAgentsDir = join(installPath, "agents")
          if (isDir(pluginAgentsDir)) {
            for (const e of readdirSync(pluginAgentsDir)) {
              if (e.endsWith(".md") && !e.startsWith(".")) {
                const fullName = `${pluginName}:${e.replace(".md", "")}`
                if (!seenNames.has(fullName)) {
                  seenNames.add(fullName)
                  agents.push({ name: fullName, source: "plugin", pluginName, filePath: join(pluginAgentsDir, e) })
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name))
}

function filterSessionsByDays(files: string[], days: number): string[] {
  const cutoffMs = Date.now() - days * 86400000
  const filtered: string[] = []
  for (const f of files) {
    const mtimeMs = statSync(f).mtimeMs
    if (mtimeMs >= cutoffMs) {
      filtered.push(f)
    }
  }
  return filtered
}

function buildSessionTurns(filepath: string): { turns: Turn[]; sessionDate: string } {
  const turns: Turn[] = []
  const timestamps: Date[] = []
  const fileMtime = new Date(statSync(filepath).mtimeMs)

  const entries = parseJsonlFile(filepath)

  let currentUserTexts: string[] = []
  let currentAiTexts: string[] = []
  let currentTools: string[] = []
  let currentSkills: string[] = []
  let currentSubagents: string[] = []

  function flushTurn(): void {
    if (currentUserTexts.length === 0 && currentAiTexts.length === 0) {
      return
    }
    const human = currentUserTexts.length > 0 ? currentUserTexts.join("\n") : ""
    // Combine AI texts, take first meaningful one
    let ai = ""
    for (const t of currentAiTexts) {
      if (t.length > 5) {
        ai = t
        break
      }
    }
    if (human) {
      // Only save turns where user actually said something
      turns.push({
        human: human.slice(0, 500),
        ai: ai.slice(0, 300),
        tools: [...currentTools],
        skills: [...currentSkills],
        subagents: [...currentSubagents],
      })
    }
  }

  let lastType: string | null = null
  for (const entry of entries) {
    const entryType = (entry as Record<string, unknown>).type as string | undefined

    if (entryType === "file-history-snapshot") {
      const snapshot = ((entry as Record<string, unknown>).snapshot as Record<string, unknown> | undefined) ?? {}
      const tsStr = snapshot.timestamp as string | undefined
      if (tsStr) {
        try {
          const ts = new Date(tsStr.replace("Z", "+00:00"))
          if (!Number.isNaN(ts.getTime())) {
            timestamps.push(ts)
          }
        } catch {
          // skip
        }
      }
    } else if (entryType === "user") {
      if (lastType === "assistant" && currentUserTexts.length > 0) {
        flushTurn()
        currentUserTexts = []
        currentAiTexts = []
        currentTools = []
        currentSkills = []
        currentSubagents = []
      }

      const msg = ((entry as Record<string, unknown>).message as Record<string, unknown> | undefined) ?? {}
      const content = (msg.content as string | ContentItem[]) ?? ""
      currentUserTexts.push(...extractHumanTexts(content))
      lastType = "user"
    } else if (entryType === "assistant") {
      const msg = ((entry as Record<string, unknown>).message as Record<string, unknown> | undefined) ?? {}
      const content = (msg.content as ContentItem[]) ?? []
      const ai = extractAssistantContent(content)
      currentAiTexts.push(...ai.texts)
      currentTools.push(...ai.tools)
      currentSkills.push(...ai.skills)
      currentSubagents.push(...ai.subagents)
      lastType = "assistant"
    }
  }

  flushTurn()

  let sessionDate: string
  if (timestamps.length > 0) {
    const minTs = timestamps.reduce((a, b) => (a.getTime() < b.getTime() ? a : b))
    sessionDate = minTs.toISOString().slice(0, 10)
  } else {
    sessionDate = fileMtime.toISOString().slice(0, 10)
  }
  return { turns, sessionDate }
}

function buildSessionMetadata(filepath: string): SessionMetadata {
  const entries = parseJsonlFile(filepath)

  let autoCompactCount = 0
  const compactTimestamps: string[] = []
  const compactPreTokens: number[] = []
  let clearCount = 0
  const totalEntries = entries.length
  const mainToolCounts = new Map<string, number>()
  const subagentToolCounts = new Map<string, number>()
  const subagentLaunches: SubagentLaunch[] = []
  const sessionSummaries: string[] = []
  const mainBashCommands: string[] = []
  const slashCommands: string[] = []

  for (const entry of entries) {
    const entryType = ((entry as Record<string, unknown>).type as string) ?? ""
    const isSidechain = ((entry as Record<string, unknown>).isSidechain as boolean) ?? false

    // --- auto-compact detection ---
    if (entryType === "system") {
      const subtype = ((entry as Record<string, unknown>).subtype as string) ?? ""
      if (subtype === "compact_boundary") {
        const meta = ((entry as Record<string, unknown>).compactMetadata as Record<string, unknown>) ?? {}
        if (meta.trigger === "auto") {
          autoCompactCount++
          const ts = ((entry as Record<string, unknown>).timestamp as string) ?? ""
          if (ts) {
            compactTimestamps.push(ts)
          }
          const preTokens = meta.preTokens as number | undefined
          if (preTokens !== undefined && preTokens !== null) {
            compactPreTokens.push(preTokens)
          }
        }
      }
    }

    // --- /clear detection ---
    if (entryType === "user") {
      const msg = ((entry as Record<string, unknown>).message as Record<string, unknown>) ?? {}
      const content = msg.content
      let rawText = ""
      if (typeof content === "string") {
        rawText = content
      } else if (Array.isArray(content)) {
        for (const item of content) {
          if (typeof item === "object" && item !== null) {
            rawText += `${((item as Record<string, unknown>).text as string) ?? ""} `
            const itemContent = (item as Record<string, unknown>).content
            if (typeof itemContent === "string") {
              rawText += `${itemContent} `
            }
          }
        }
      }
      const toolResult = ((entry as Record<string, unknown>).toolUseResult as Record<string, unknown>) ?? {}
      if (typeof toolResult === "object" && toolResult !== null) {
        rawText += (toolResult.stdout as string) ?? ""
      }
      if (rawText.includes("<command-name>/clear</command-name>")) {
        clearCount++
      }
      // Detect all slash commands
      const slashRegex = /<command-name>(\/[a-zA-Z0-9_:-]+)<\/command-name>/g
      for (const m of rawText.matchAll(slashRegex)) {
        slashCommands.push(m[1])
      }
    }

    // --- Tool usage (main vs SubAgent) ---
    if (entryType === "assistant") {
      const msg = ((entry as Record<string, unknown>).message as Record<string, unknown>) ?? {}
      const content = msg.content
      if (Array.isArray(content)) {
        for (const item of content) {
          if (typeof item === "object" && item !== null && (item as Record<string, unknown>).type === "tool_use") {
            const toolName = ((item as Record<string, unknown>).name as string) ?? "unknown"
            if (isSidechain) {
              counterIncrement(subagentToolCounts, toolName)
            } else {
              counterIncrement(mainToolCounts, toolName)
            }
            if (toolName === "Bash" && !isSidechain) {
              const inp = ((item as Record<string, unknown>).input as Record<string, unknown>) ?? {}
              const cmd = (inp.command as string) ?? ""
              if (cmd) {
                mainBashCommands.push(cmd.slice(0, 200))
              }
            }
            if (toolName === "Agent" || toolName === "Task") {
              const inp = ((item as Record<string, unknown>).input as Record<string, unknown>) ?? {}
              subagentLaunches.push({
                type: (inp.subagent_type as string) ?? "unknown",
                description: ((inp.description as string) ?? "").slice(0, 100),
              })
            }
          }
        }
      }
    }

    // --- Session summaries ---
    if (entryType === "summary") {
      const summaryText = ((entry as Record<string, unknown>).summary as string) ?? ""
      if (summaryText) {
        sessionSummaries.push(summaryText)
      }
    }
  }

  return {
    auto_compact_count: autoCompactCount,
    compact_timestamps: compactTimestamps,
    compact_pre_tokens: compactPreTokens,
    clear_count: clearCount,
    slash_commands: slashCommands,
    total_entries: totalEntries,
    main_tool_counts: counterMostCommon(mainToolCounts, 15),
    subagent_tool_counts: counterMostCommon(subagentToolCounts, 10),
    subagent_launches: subagentLaunches,
    session_summaries: sessionSummaries,
    main_bash_commands: mainBashCommands,
  }
}

// ============================================================
// Raw mode: output raw conversations for AI analysis
// ============================================================

function runRawMode(sessionsDirs: Array<{ sessionsDir: string; shortName: string }>, days: number): RawModeOutput {
  const sessions: RawSession[] = []
  let totalHumanTurns = 0

  for (const { sessionsDir, shortName } of sessionsDirs) {
    let jsonlFiles = [...new Bun.Glob("*.jsonl").scanSync({ cwd: sessionsDir, absolute: true })].sort()
    jsonlFiles = filterSessionsByDays(jsonlFiles, days)

    for (const filepath of jsonlFiles) {
      const { turns, sessionDate } = buildSessionTurns(filepath)
      if (turns.length === 0) continue
      totalHumanTurns += turns.length
      const metadata = buildSessionMetadata(filepath)
      sessions.push({
        date: sessionDate,
        file: basename(filepath),
        project: shortName,
        turns,
        metadata,
      })
    }
  }

  // Sort by date descending
  sessions.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))

  const totalAutoCompacts = sessions.reduce((sum, s) => sum + (s.metadata?.auto_compact_count ?? 0), 0)
  const totalClears = sessions.reduce((sum, s) => sum + (s.metadata?.clear_count ?? 0), 0)
  const totalSubagentLaunches = sessions.reduce((sum, s) => sum + (s.metadata?.subagent_launches?.length ?? 0), 0)
  const sessionsWithCompactsCount = sessions.filter((s) => (s.metadata?.auto_compact_count ?? 0) > 0).length
  const longSessionsCount = sessions.filter((s) => (s.turns?.length ?? 0) > 20).length

  const allDates = sessions.map((s) => s.date)
  const existing = findExistingSkillsAndCommands(process.cwd())
  const existingAgents = findExistingAgents(process.cwd())

  return {
    meta: {
      mode: "raw",
      project_count: sessionsDirs.length,
      session_count: sessions.length,
      days,
      date_range: {
        from: allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : "N/A",
        to: allDates.length > 0 ? allDates.reduce((a, b) => (a > b ? a : b)) : "N/A",
      },
      total_human_turns: totalHumanTurns,
      total_auto_compacts: totalAutoCompacts,
      total_clears: totalClears,
      total_subagent_launches: totalSubagentLaunches,
      sessions_with_compacts: sessionsWithCompactsCount,
      long_sessions_count: longSessionsCount,
      analyzed_at: new Date().toISOString(),
    },
    sessions,
    existing_skills: existing.existing_skills,
    existing_commands: existing.existing_commands,
    existing_agents: existingAgents,
  }
}

// ============================================================
// Batch Splitting (for SubAgent-friendly output)
// ============================================================

const BATCH_TARGET_LINES = 1500

function estimateSessionLines(session: RawSession): number {
  const turnsLines = session.turns.length * 12
  const metadataLines =
    30 +
    (session.metadata?.subagent_launches?.length ?? 0) * 3 +
    (session.metadata?.session_summaries?.length ?? 0) * 2 +
    (session.metadata?.main_bash_commands?.length ?? 0) * 2
  return 8 + turnsLines + metadataLines
}

interface BatchSplitResult {
  indexOutput: RawIndexOutput
  batchOutputs: SessionBatchOutput[]
  batchFilePaths: string[]
}

function buildBatchSplit(fullOutput: RawModeOutput, outputDir: string, batchPrefix: string): BatchSplitResult {
  const sessions = fullOutput.sessions
  const batches: RawSession[][] = []
  let currentBatch: RawSession[] = []
  let currentLines = 10

  for (const session of sessions) {
    const sessionLines = estimateSessionLines(session)
    if (currentLines + sessionLines > BATCH_TARGET_LINES && currentBatch.length > 0) {
      batches.push(currentBatch)
      currentBatch = [session]
      currentLines = 10 + sessionLines
    } else {
      currentBatch.push(session)
      currentLines += sessionLines
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  const totalBatches = batches.length
  const batchFilePaths: string[] = []
  const batchOutputs: SessionBatchOutput[] = []

  for (let i = 0; i < totalBatches; i++) {
    const batchPath = `${outputDir}/${batchPrefix}-sessions-${i + 1}.json`
    batchFilePaths.push(batchPath)
    batchOutputs.push({
      batch_number: i + 1,
      total_batches: totalBatches,
      sessions: batches[i],
    })
  }

  const sessionIndex: SessionIndexEntry[] = []
  for (let i = 0; i < totalBatches; i++) {
    for (const session of batches[i]) {
      sessionIndex.push({
        date: session.date,
        project: session.project,
        num_turns: session.turns.length,
        auto_compact_count: session.metadata?.auto_compact_count ?? 0,
        batch_file: batchFilePaths[i],
      })
    }
  }

  const indexOutput: RawIndexOutput = {
    meta: fullOutput.meta,
    existing_skills: fullOutput.existing_skills,
    existing_commands: fullOutput.existing_commands,
    existing_agents: fullOutput.existing_agents,
    session_files: batchFilePaths,
    session_index: sessionIndex,
  }

  return { indexOutput, batchOutputs, batchFilePaths }
}

// ============================================================
// CLI Entry Point
// ============================================================

function parseArgs(): { days: number; output: string | null } {
  const args = process.argv.slice(2)
  let days = 3
  let output: string | null = null
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--days":
        days = parseInt(args[++i] ?? "3", 10)
        break
      case "--output":
        output = args[++i] ?? null
        break
    }
  }
  return { days, output }
}

const { days, output } = parseArgs()

const sessionsDirs = getAllSessionsDirs()
if (sessionsDirs.length === 0) {
  console.log(JSON.stringify({ error: "No project session directories found in ~/.claude/projects/" }))
  process.exit(1)
}

const result = runRawMode(sessionsDirs, days)

const outputJson = JSON.stringify(result, null, 2)
if (output) {
  await Bun.write(output, outputJson)

  const outputDir = output.replace(/\/[^/]+$/, "")
  const outputBasename = basename(output, ".json")
  const { indexOutput, batchOutputs, batchFilePaths } = buildBatchSplit(result, outputDir, outputBasename)

  for (let i = 0; i < batchOutputs.length; i++) {
    await Bun.write(batchFilePaths[i], JSON.stringify(batchOutputs[i], null, 2))
  }

  const indexPath = output.replace(/\.json$/, "-index.json")
  await Bun.write(indexPath, JSON.stringify(indexOutput, null, 2))

  console.log(
    JSON.stringify({
      status: "ok",
      output,
      index: indexPath,
      batches: batchFilePaths,
      session_count: result.meta.session_count,
      batch_count: batchOutputs.length,
    }),
  )
} else {
  console.log(outputJson)
}
