import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

// === Types ===

interface PhaseStatus {
  number: number;
  name: string;
  items: {
    pending: number;
    inProgress: number;
    done: number;
    blocked: number;
    total: number;
  };
}

interface ItemInfo {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "done" | "blocked";
}

interface SessionEntry {
  number: number;
  timestamp: string;
  exitReason: string;
  sessionId: string | null;
  costUsd: number | null;
  durationMs: number | null;
  numTurns: number | null;
  completedItems: string[];
  changedFiles: string[];
}

interface VisionInfo {
  exists: boolean;
  purpose: string | null;
  goalCount: number;
  goals: Array<{ text: string; status: "pending" | "done" }>;
}

interface PlanInfo {
  filename: string;
  name: string;
  goalsCovered: string[];
  stepCount: number;
  created: string | null;
}

interface PlansStatus {
  count: number;
  files: PlanInfo[];
  coveredGoalCount: number;
  totalGoalCount: number;
}

interface LoopStatusOutput {
  loopDir: string;
  projectName: string;
  isRunning: boolean;
  isStopped: boolean;
  progress: {
    pending: number;
    inProgress: number;
    done: number;
    blocked: number;
    total: number;
    percentComplete: number;
  };
  phases: PhaseStatus[];
  discoveredItems: {
    count: number;
    items: ItemInfo[];
  };
  blockedItems: Array<{ id: string; title: string }>;
  inProgressItems: Array<{ id: string; title: string }>;
  sessions: {
    count: number;
    entries: SessionEntry[];
    totalCostUsd: number | null;
    averageCostUsd: number | null;
    averageDurationMs: number | null;
  };
  vision: VisionInfo | null;
  plans: PlansStatus | null;
  learnings: { exists: boolean; lineCount: number } | null;
  sessionHandoff: { exists: boolean } | null;
  error?: string;
  warnings: string[];
}

// === Parsing Helpers ===

const ITEM_RE = /^- \[( |~|x|!)\] \*\*(.+?)\*\*:?\s*(.+)?/;
const PHASE_RE = /^## Phase (\d+): (.+)/;
const SESSION_LOG_RE =
  /^### Session (\d+) \((.+?)\) \[exit: (.+?)\](?:\s*\[session: (.+?)\])?(?:\s*\[cost: \$(.+?)\])?/;

function parseItemStatus(marker: string): ItemInfo["status"] {
  switch (marker) {
    case " ":
      return "pending";
    case "~":
      return "in-progress";
    case "x":
      return "done";
    case "!":
      return "blocked";
    default:
      return "pending";
  }
}

type SessionLogEntry = {
  number: number;
  timestamp: string;
  exitReason: string;
  sessionId: string | null;
  costUsd: number | null;
  completedItems: string[];
  changedFiles: string[];
};

function parseSessionLogContent(content: string): SessionLogEntry[] {
  const lines = content.split("\n");
  const entries: SessionLogEntry[] = [];

  for (const line of lines) {
    const sessionMatch = line.match(SESSION_LOG_RE);
    if (sessionMatch) {
      entries.push({
        number: parseInt(sessionMatch[1], 10),
        timestamp: sessionMatch[2],
        exitReason: sessionMatch[3],
        sessionId: sessionMatch[4] ?? null,
        costUsd: sessionMatch[5] ? parseFloat(sessionMatch[5]) : null,
        completedItems: [],
        changedFiles: [],
      });
    } else if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      const completedMatch = line.match(/^- Completed: (.+)/);
      if (completedMatch) {
        lastEntry.completedItems = completedMatch[1].split(",").map((s) => s.trim());
      }
      const changedMatch = line.match(/^- Changed files: (.+)/);
      if (changedMatch) {
        lastEntry.changedFiles = changedMatch[1]
          .replace(/\s*\(\+\d+ more\)/, "")
          .split(",")
          .map((s) => s.trim());
      }
    }
  }

  return entries;
}

function parseProgressFile(content: string): {
  projectName: string;
  phases: PhaseStatus[];
  discoveredItems: { count: number; items: ItemInfo[] };
  blockedItems: Array<{ id: string; title: string }>;
  inProgressItems: Array<{ id: string; title: string }>;
  sessionLogEntries: SessionLogEntry[];
  counts: { pending: number; inProgress: number; done: number; blocked: number };
} {
  const lines = content.split("\n");

  // Extract project name
  let projectName = "unknown";
  const titleMatch = lines[0]?.match(/^# (.+?) - Loop Progress/);
  if (titleMatch) {
    projectName = titleMatch[1];
  }

  // Parse all items with simple counting (fallback-safe, same as run-loop.ts)
  const counts = { pending: 0, inProgress: 0, done: 0, blocked: 0 };
  for (const line of lines) {
    if (line.startsWith("- [ ]")) counts.pending++;
    else if (line.startsWith("- [~]")) counts.inProgress++;
    else if (line.startsWith("- [x]")) counts.done++;
    else if (line.startsWith("- [!]")) counts.blocked++;
  }

  // Parse phases with structured item tracking
  const phases: PhaseStatus[] = [];
  const allItems: Array<ItemInfo & { phaseIndex: number }> = [];
  let currentPhaseIndex = -1;
  let inDiscoveredSection = false;
  let inSessionLogSection = false;

  const discoveredItems: ItemInfo[] = [];
  const sessionLogEntries: SessionLogEntry[] = [];

  for (const line of lines) {
    // Detect section boundaries
    const phaseMatch = line.match(PHASE_RE);
    if (phaseMatch) {
      inDiscoveredSection = false;
      inSessionLogSection = false;
      currentPhaseIndex = phases.length;
      phases.push({
        number: parseInt(phaseMatch[1], 10),
        name: phaseMatch[2],
        items: { pending: 0, inProgress: 0, done: 0, blocked: 0, total: 0 },
      });
      continue;
    }

    if (line.startsWith("## Discovered Items")) {
      inDiscoveredSection = true;
      inSessionLogSection = false;
      currentPhaseIndex = -1;
      continue;
    }

    // Backward compat: old loops have ## Session Log in PROGRESS.md
    if (line.startsWith("## Session Log")) {
      inSessionLogSection = true;
      inDiscoveredSection = false;
      currentPhaseIndex = -1;
      continue;
    }

    if (line.startsWith("## ") && !line.startsWith("## Phase")) {
      inDiscoveredSection = false;
      inSessionLogSection = false;
      currentPhaseIndex = -1;
      continue;
    }

    // Parse items
    const itemMatch = line.match(ITEM_RE);
    if (itemMatch) {
      const status = parseItemStatus(itemMatch[1]);
      const id = itemMatch[2];
      const title = itemMatch[3]?.trim() ?? "";
      const item: ItemInfo = { id, title, status };

      if (inDiscoveredSection) {
        discoveredItems.push(item);
      } else if (currentPhaseIndex >= 0) {
        allItems.push({ ...item, phaseIndex: currentPhaseIndex });
        const phase = phases[currentPhaseIndex];
        phase.items.total++;
        switch (status) {
          case "pending":
            phase.items.pending++;
            break;
          case "in-progress":
            phase.items.inProgress++;
            break;
          case "done":
            phase.items.done++;
            break;
          case "blocked":
            phase.items.blocked++;
            break;
        }
      }
    }

    // Parse session log entries from PROGRESS.md (backward compat for old loops)
    if (inSessionLogSection) {
      const sessionMatch = line.match(SESSION_LOG_RE);
      if (sessionMatch) {
        sessionLogEntries.push({
          number: parseInt(sessionMatch[1], 10),
          timestamp: sessionMatch[2],
          exitReason: sessionMatch[3],
          sessionId: sessionMatch[4] ?? null,
          costUsd: sessionMatch[5] ? parseFloat(sessionMatch[5]) : null,
          completedItems: [],
          changedFiles: [],
        });
      } else if (sessionLogEntries.length > 0) {
        const lastEntry = sessionLogEntries[sessionLogEntries.length - 1];
        const completedMatch = line.match(/^- Completed: (.+)/);
        if (completedMatch) {
          lastEntry.completedItems = completedMatch[1].split(",").map((s) => s.trim());
        }
        const changedMatch = line.match(/^- Changed files: (.+)/);
        if (changedMatch) {
          lastEntry.changedFiles = changedMatch[1]
            .replace(/\s*\(\+\d+ more\)/, "")
            .split(",")
            .map((s) => s.trim());
        }
      }
    }
  }

  // Collect blocked items
  const blockedItems = allItems
    .filter((item) => item.status === "blocked")
    .map(({ id, title }) => ({ id, title }));

  // Also include blocked discovered items
  for (const item of discoveredItems) {
    if (item.status === "blocked") {
      blockedItems.push({ id: item.id, title: item.title });
    }
  }

  // Collect in-progress items
  const inProgressItems = allItems
    .filter((item) => item.status === "in-progress")
    .map(({ id, title }) => ({ id, title }));

  for (const item of discoveredItems) {
    if (item.status === "in-progress") {
      inProgressItems.push({ id: item.id, title: item.title });
    }
  }

  return {
    projectName,
    phases,
    discoveredItems: { count: discoveredItems.length, items: discoveredItems },
    blockedItems,
    inProgressItems,
    sessionLogEntries,
    counts,
  };
}

function parseSessionLogs(
  logDir: string,
  sessionLogEntries: Array<{
    number: number;
    timestamp: string;
    exitReason: string;
    sessionId: string | null;
    costUsd: number | null;
    completedItems: string[];
    changedFiles: string[];
  }>,
): { entries: SessionEntry[]; totalCostUsd: number | null; averageCostUsd: number | null; averageDurationMs: number | null } {
  if (!existsSync(logDir)) {
    // Fall back to PROGRESS.md session log entries only (no cost data)
    return {
      entries: sessionLogEntries.map((e) => ({
        ...e,
        costUsd: e.costUsd ?? null,
        durationMs: null,
        numTurns: null,
      })),
      totalCostUsd: null,
      averageCostUsd: null,
      averageDurationMs: null,
    };
  }

  const logFiles = readdirSync(logDir)
    .filter((f) => /^session-\d+\.log$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/session-(\d+)/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/session-(\d+)/)?.[1] ?? "0", 10);
      return numA - numB;
    });

  // Build a map of session number → {sessionId, costUsd, durationMs, numTurns} from log files
  const logData = new Map<
    number,
    { sessionId: string | null; costUsd: number | null; durationMs: number | null; numTurns: number | null }
  >();
  for (const file of logFiles) {
    const num = parseInt(file.match(/session-(\d+)/)?.[1] ?? "0", 10);
    let sessionId: string | null = null;
    let costUsd: number | null = null;
    let durationMs: number | null = null;
    let numTurns: number | null = null;

    try {
      const content = readFileSync(resolve(logDir, file), "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "init" && event.session_id) {
            sessionId = event.session_id;
          }
          if (event.type === "result") {
            if (event.cost_usd !== undefined) {
              costUsd = event.cost_usd;
            }
            if (event.duration_ms !== undefined) {
              durationMs = event.duration_ms;
            }
            if (event.num_turns !== undefined) {
              numTurns = event.num_turns;
            }
          }
        } catch {
          // Skip malformed NDJSON lines
        }
      }
    } catch {
      // Skip unreadable log files
    }

    logData.set(num, { sessionId, costUsd, durationMs, numTurns });
  }

  // Merge PROGRESS.md session log with .loop-logs data
  const entries: SessionEntry[] = [];

  // Use PROGRESS.md entries as the base (they have timestamps and exit reasons)
  for (const entry of sessionLogEntries) {
    const logInfo = logData.get(entry.number);
    entries.push({
      number: entry.number,
      timestamp: entry.timestamp,
      exitReason: entry.exitReason,
      sessionId: logInfo?.sessionId ?? entry.sessionId,
      costUsd: logInfo?.costUsd ?? entry.costUsd ?? null,
      durationMs: logInfo?.durationMs ?? null,
      numTurns: logInfo?.numTurns ?? null,
      completedItems: entry.completedItems,
      changedFiles: entry.changedFiles,
    });
  }

  // If there are log files without PROGRESS.md entries (e.g., session in progress)
  for (const [num, info] of logData) {
    if (!sessionLogEntries.some((e) => e.number === num)) {
      entries.push({
        number: num,
        timestamp: "",
        exitReason: "unknown",
        sessionId: info.sessionId,
        costUsd: info.costUsd,
        durationMs: info.durationMs,
        numTurns: info.numTurns,
        completedItems: [],
        changedFiles: [],
      });
    }
  }

  entries.sort((a, b) => a.number - b.number);

  const costs = entries.map((e) => e.costUsd).filter((c): c is number => c !== null);
  const totalCostUsd = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) : null;
  const averageCostUsd = costs.length > 0 ? totalCostUsd! / costs.length : null;

  const durations = entries.map((e) => e.durationMs).filter((d): d is number => d !== null);
  const averageDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  return { entries, totalCostUsd, averageCostUsd, averageDurationMs };
}

function parseVision(visionPath: string): VisionInfo | null {
  if (!existsSync(visionPath)) return null;

  try {
    const content = readFileSync(visionPath, "utf-8");
    const lines = content.split("\n");

    // Extract purpose
    let purpose: string | null = null;
    let inPurpose = false;
    for (const line of lines) {
      if (line.startsWith("## Purpose")) {
        inPurpose = true;
        continue;
      }
      if (inPurpose && line.startsWith("##")) break;
      if (inPurpose && line.trim()) {
        purpose = line.trim();
        break;
      }
    }

    // Extract goals
    const goals: Array<{ text: string; status: "pending" | "done" }> = [];
    let inGoals = false;
    for (const line of lines) {
      if (line.startsWith("## Goals")) {
        inGoals = true;
        continue;
      }
      if (inGoals && line.startsWith("##")) break;
      if (inGoals) {
        const goalMatch = line.match(/^- \[([ x])\] (.+)/);
        if (goalMatch) {
          goals.push({
            text: goalMatch[2],
            status: goalMatch[1] === "x" ? "done" : "pending",
          });
        }
      }
    }

    return {
      exists: true,
      purpose,
      goalCount: goals.length,
      goals,
    };
  } catch {
    return null;
  }
}

function parsePlans(loopDir: string, goals: string[]): PlansStatus | null {
  const glob = new Bun.Glob("PLAN-*.md");
  const planFiles = Array.from(glob.scanSync({ cwd: loopDir, absolute: false })).sort();

  if (planFiles.length === 0) return null;

  const allCoveredGoals = new Set<string>();
  const files: PlanInfo[] = [];

  for (const filename of planFiles) {
    const filePath = resolve(loopDir, filename);
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Extract plan name from heading
      let name = filename;
      const headingMatch = lines[0]?.match(/^# Plan: (.+)/);
      if (headingMatch) {
        name = headingMatch[1];
      }

      // Extract created date
      let created: string | null = null;
      for (const line of lines) {
        const createdMatch = line.match(/^\*\*Created\*\*:\s*(.+)/);
        if (createdMatch) {
          created = createdMatch[1].trim();
          break;
        }
      }

      // Extract Goals Covered
      const goalsCovered: string[] = [];
      let inGoalsCovered = false;
      for (const line of lines) {
        if (line.startsWith("## Goals Covered")) {
          inGoalsCovered = true;
          continue;
        }
        if (inGoalsCovered && line.startsWith("##")) break;
        if (inGoalsCovered) {
          const goalMatch = line.match(/^- (.+)/);
          if (goalMatch) {
            goalsCovered.push(goalMatch[1].trim());
            allCoveredGoals.add(goalMatch[1].trim());
          }
        }
      }

      // Count steps
      let stepCount = 0;
      for (const line of lines) {
        if (line.match(/^### Step: /)) {
          stepCount++;
        }
      }

      files.push({ filename, name, goalsCovered, stepCount, created });
    } catch {
      // Skip unreadable plan files
    }
  }

  const goalSet = new Set(goals);
  const coveredGoalCount = [...allCoveredGoals].filter((g) => goalSet.has(g)).length;

  return {
    count: files.length,
    files,
    coveredGoalCount,
    totalGoalCount: goals.length,
  };
}

// === Auto-Discovery ===

function findRepoRoot(): string | null {
  const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim();
}

function discoverLoopDir(): string | { multiple: { name: string; dir: string }[] } | null {
  const repoRoot = findRepoRoot();
  if (!repoRoot) return null;
  const agentLoopsDir = resolve(repoRoot, ".agent-loops");
  if (!existsSync(agentLoopsDir)) return null;

  const loops = readdirSync(agentLoopsDir)
    .filter((d) => {
      const dirPath = resolve(agentLoopsDir, d);
      return (
        statSync(dirPath).isDirectory() &&
        existsSync(resolve(dirPath, "PROGRESS.md"))
      );
    })
    .map((d) => ({ name: d, dir: resolve(agentLoopsDir, d) }))
    .sort((a, b) => {
      // Date-prefixed names (YYYYMMDD-*) sort newest first; legacy names sort last
      const dateA = a.name.match(/^(\d{8})-/)?.[1] ?? "";
      const dateB = b.name.match(/^(\d{8})-/)?.[1] ?? "";
      if (dateA && dateB) return dateB.localeCompare(dateA);
      if (dateA) return -1;
      if (dateB) return 1;
      return a.name.localeCompare(b.name);
    });

  if (loops.length === 0) return null;
  if (loops.length === 1) return loops[0].dir;
  return { multiple: loops };
}

// === Status Builder ===

function buildStatus(loopDir: string): LoopStatusOutput | { loopDir: string; error: string; warnings: string[] } {
  const warnings: string[] = [];

  const progressPath = resolve(loopDir, "PROGRESS.md");
  if (!existsSync(progressPath)) {
    return {
      loopDir,
      error: `No PROGRESS.md found in ${loopDir}. This may not be a loop directory.`,
      warnings: [],
    };
  }

  try {
    const progressContent = readFileSync(progressPath, "utf-8");
    const progress = parseProgressFile(progressContent);

    // Prefer session-log.md; fall back to PROGRESS.md ## Session Log for old loops
    const sessionLogPath = resolve(loopDir, "session-log.md");
    let sessionLogEntries = progress.sessionLogEntries;
    if (existsSync(sessionLogPath)) {
      const sessionLogContent = readFileSync(sessionLogPath, "utf-8");
      const parsed = parseSessionLogContent(sessionLogContent);
      if (parsed.length > 0) {
        sessionLogEntries = parsed;
      }
    }

    const logDir = resolve(loopDir, ".loop-logs");
    if (!existsSync(logDir)) {
      warnings.push("No .loop-logs directory found — session cost data unavailable");
    }
    const sessions = parseSessionLogs(logDir, sessionLogEntries);

    const visionPath = resolve(loopDir, "VISION.md");
    const vision = parseVision(visionPath);
    const plans = parsePlans(loopDir, vision?.goals.map((g) => g.text) ?? []);
    if (!vision) {
      warnings.push("No VISION.md found");
    }

    const isStopped = existsSync(resolve(loopDir, "STOP"));
    const total =
      progress.counts.pending +
      progress.counts.inProgress +
      progress.counts.done +
      progress.counts.blocked;
    const percentComplete =
      total > 0 ? Math.round((progress.counts.done / total) * 100) : 0;
    const isRunning =
      !isStopped &&
      (progress.counts.pending > 0 || progress.counts.inProgress > 0);

    // Detect cross-session intelligence files
    const learningsPath = resolve(loopDir, "LEARNINGS.md");
    let learnings: { exists: boolean; lineCount: number } | null = null;
    if (existsSync(learningsPath)) {
      try {
        const lc = readFileSync(learningsPath, "utf-8").split("\n").length;
        learnings = { exists: true, lineCount: lc };
      } catch {
        learnings = { exists: true, lineCount: 0 };
      }
    }

    const handoffPath = resolve(loopDir, "SESSION_HANDOFF.md");
    const sessionHandoff = existsSync(handoffPath)
      ? { exists: true }
      : null;

    return {
      loopDir,
      projectName: progress.projectName,
      isRunning,
      isStopped,
      progress: {
        ...progress.counts,
        total,
        percentComplete,
      },
      phases: progress.phases,
      discoveredItems: progress.discoveredItems,
      blockedItems: progress.blockedItems,
      inProgressItems: progress.inProgressItems,
      sessions: {
        count: sessions.entries.length,
        ...sessions,
      },
      vision,
      plans,
      learnings,
      sessionHandoff,
      warnings,
    };
  } catch (e) {
    return {
      loopDir,
      error: `Failed to parse loop status: ${e instanceof Error ? e.message : String(e)}`,
      warnings: [],
    };
  }
}

// === Main ===

function resolveLoopDir(): string | null {
  // Filter out flags from positional args
  const positionalArgs = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const explicitArg = positionalArgs[0];

  if (explicitArg && explicitArg !== ".") {
    return resolve(process.cwd(), explicitArg);
  }

  const discovered = discoverLoopDir();
  if (discovered === null) {
    return resolve(process.cwd(), explicitArg ?? ".");
  }
  if (typeof discovered === "string") {
    return discovered;
  }

  // Multiple loops — output selection prompt
  console.log(
    JSON.stringify({
      multipleLoops: true,
      available: discovered.multiple.map((l) => l.name),
      agentLoopsDir: resolve(findRepoRoot()!, ".agent-loops"),
      warnings: [],
    }),
  );
  return null;
}

async function main(): Promise<void> {
  const loopDir = resolveLoopDir();
  if (!loopDir) return;

  const watchMode = process.argv.includes("--watch");
  const intervalArg = process.argv.find(a => a.startsWith("--interval="));
  const interval = parseInt(intervalArg?.split("=")[1] ?? "30", 10);

  if (watchMode) {
    const progressPath = resolve(loopDir, "PROGRESS.md");
    const stopPath = resolve(loopDir, "STOP");
    let lastMtime = 0;

    while (true) {
      const stopExists = existsSync(stopPath);
      const mtime = existsSync(progressPath) ? statSync(progressPath).mtimeMs : 0;

      if (mtime !== lastMtime || stopExists) {
        lastMtime = mtime;
        const output = buildStatus(loopDir);
        console.log(JSON.stringify(output));

        // Exit watch when loop is done
        if ("isStopped" in output && (output.isStopped || output.progress.percentComplete === 100 || !output.isRunning)) break;
        if ("error" in output) break;
      }

      await Bun.sleep(interval * 1000);
    }
  } else {
    const output = buildStatus(loopDir);
    console.log(JSON.stringify(output));
  }
}

main();
