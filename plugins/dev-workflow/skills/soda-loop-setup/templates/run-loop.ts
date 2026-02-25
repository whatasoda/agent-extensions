#!/usr/bin/env bun
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// === Configuration (env vars with defaults) ===
const config = {
  loopDir: process.env.LOOP_DIR ?? import.meta.dir,
  claudeModel: process.env.CLAUDE_MODEL ?? "opus",
  maxSessions: parseInt(process.env.MAX_SESSIONS ?? "10", 10),
  maxBudgetUsd: parseFloat(process.env.MAX_BUDGET_USD ?? "20"),
  cooldownSecs: parseInt(process.env.COOLDOWN_SECS ?? "5", 10),
  idleTimeout: parseInt(process.env.IDLE_TIMEOUT ?? "1800", 10),
  dryRun: process.env.DRY_RUN === "1",
  allowedTools: process.env.ALLOWED_TOOLS ?? "Read,Write,Edit,Bash,Glob,Grep",
  summaryEnabled: process.env.LOOP_SUMMARY !== "0",
  summaryBudgetUsd: parseFloat(process.env.SUMMARY_BUDGET_USD ?? "1"),
  qualityGate: process.env.QUALITY_GATE !== "0",
};

const PROGRESS_FILE = resolve(config.loopDir, "PROGRESS.md");
const PROMPT_FILE = resolve(config.loopDir, "AGENT_PROMPT.md");
const STOP_FILE = resolve(config.loopDir, "STOP");
const LOG_DIR = resolve(config.loopDir, ".loop-logs");

// === Stream-JSON Event Types ===
// Handle both legacy CLI format (type:"init") and SDK format (type:"system", subtype:"init")
interface StreamEventInit {
  type: "init";
  session_id: string;
}
interface StreamEventSystem {
  type: "system";
  subtype: string;
  session_id?: string;
}
interface ContentBlockText {
  type: "text";
  text: string;
}
interface ContentBlockToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
type ContentBlock = ContentBlockText | ContentBlockToolUse;
interface StreamEventAssistant {
  type: "assistant";
  message: { role: "assistant"; content: ContentBlock[] };
  session_id?: string;
}
interface StreamEventUser {
  type: "user";
  message: { role: "user"; content: unknown[] };
}
interface StreamEventResult {
  type: "result";
  subtype?: string;
  result?: string;
  cost_usd?: number;
  total_cost_usd?: number;
  session_id?: string;
  num_turns?: number;
  duration_ms?: number;
  is_error?: boolean;
}
type StreamEvent =
  | StreamEventInit
  | StreamEventSystem
  | StreamEventAssistant
  | StreamEventUser
  | StreamEventResult;

// === SIGINT Handling ===
type StopState = "running" | "stopping" | "force-killing";
let stopState: StopState = "running";
let activeProcess: ReturnType<typeof Bun.spawn> | null = null;

process.on("SIGINT", () => {
  if (stopState === "running") {
    stopState = "stopping";
    log(
      "SIGINT received. Will stop after current session finishes. Press Ctrl-C again to force kill.",
    );
  } else {
    stopState = "force-killing";
    log("Second SIGINT. Force killing claude process...");
    if (activeProcess) {
      activeProcess.kill("SIGKILL");
    }
    process.exit(130);
  }
});

// === Helpers ===
function log(message: string): void {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(`[${ts}] ${message}`);
}

async function* parseNDJSON(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as StreamEvent;
        } catch {
          // skip malformed lines (e.g. partial JSON on process kill)
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer.trim()) as StreamEvent;
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// === Session Activity ===
interface SessionActivityData {
  toolUses: string[];
  textSnippets: string[];
  resultText: string | null;
  costUsd: number | null;
}

function formatSessionSummary(activity: SessionActivityData): string {
  const lines: string[] = [];
  if (activity.toolUses.length > 0) {
    const counts = new Map<string, number>();
    for (const t of activity.toolUses)
      counts.set(t, (counts.get(t) ?? 0) + 1);
    const summary = Array.from(counts.entries())
      .map(([name, c]) => (c > 1 ? `${name}(x${c})` : name))
      .join(", ");
    lines.push(`  Tools: ${summary}`);
  }
  if (activity.textSnippets.length > 0) {
    const last = activity.textSnippets[activity.textSnippets.length - 1];
    const display = last.length >= 120 ? last.slice(0, 120) + "…" : last;
    lines.push(`  Last message: "${display}"`);
  }
  if (activity.resultText) {
    const t =
      activity.resultText.length > 300
        ? activity.resultText.slice(0, 300) + "…"
        : activity.resultText;
    lines.push(`  Result: ${t}`);
  }
  if (activity.costUsd !== null) {
    lines.push(`  Cost: $${activity.costUsd.toFixed(4)}`);
  }
  return lines.length > 0 ? lines.join("\n") : "  (no activity recorded)";
}

interface ProgressCounts {
  pending: number;
  inProgress: number;
  done: number;
  blocked: number;
}

interface ProgressSnapshot {
  counts: ProgressCounts;
  itemStates: Map<string, string>;
  headSha: string;
}

const ITEM_RE = /^- \[( |~|x|!)\] \*\*(.+?)\*\*/;

async function parseProgress(): Promise<ProgressCounts> {
  const content = await Bun.file(PROGRESS_FILE).text();
  const counts: ProgressCounts = {
    pending: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
  };
  for (const line of content.split("\n")) {
    if (line.startsWith("- [ ]")) counts.pending++;
    else if (line.startsWith("- [~]")) counts.inProgress++;
    else if (line.startsWith("- [x]")) counts.done++;
    else if (line.startsWith("- [!]")) counts.blocked++;
  }
  return counts;
}

async function captureSnapshot(): Promise<ProgressSnapshot> {
  const content = await Bun.file(PROGRESS_FILE).text();
  const counts: ProgressCounts = { pending: 0, inProgress: 0, done: 0, blocked: 0 };
  const itemStates = new Map<string, string>();
  for (const line of content.split("\n")) {
    if (line.startsWith("- [ ]")) counts.pending++;
    else if (line.startsWith("- [~]")) counts.inProgress++;
    else if (line.startsWith("- [x]")) counts.done++;
    else if (line.startsWith("- [!]")) counts.blocked++;
    const m = line.match(ITEM_RE);
    if (m) {
      itemStates.set(
        m[2],
        m[1] === " " ? "pending" : m[1] === "~" ? "in-progress" : m[1] === "x" ? "done" : "blocked",
      );
    }
  }
  let headSha = "";
  try {
    const p = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: process.cwd() });
    if (p.exitCode === 0) headSha = p.stdout.toString().trim();
  } catch {}
  return { counts, itemStates, headSha };
}

async function parseVerifyCommands(): Promise<string[]> {
  try {
    const content = await Bun.file(PROMPT_FILE).text();
    const lines = content.split("\n");
    let inVerification = false;
    const commands: string[] = [];
    for (const line of lines) {
      if (line.startsWith("## Verification")) {
        inVerification = true;
        continue;
      }
      if (inVerification && line.startsWith("##")) break;
      if (inVerification) {
        const match = line.match(/^- `(.+?)`/);
        if (match) commands.push(match[1]);
      }
    }
    return commands;
  } catch {
    return [];
  }
}

async function runQualityGate(commands: string[]): Promise<boolean> {
  if (commands.length === 0) return true;
  log("Running quality gate...");
  for (const cmd of commands) {
    try {
      const p = Bun.spawnSync(["sh", "-c", cmd], {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });
      if (p.exitCode === 0) {
        log(`  PASS: ${cmd}`);
      } else {
        const stderr = p.stderr.toString().trim().slice(0, 200);
        log(`  FAIL: ${cmd} (exit ${p.exitCode})${stderr ? ` — ${stderr}` : ""}`);
        return false;
      }
    } catch (e) {
      log(`  FAIL: ${cmd} (error: ${e instanceof Error ? e.message : String(e)})`);
      return false;
    }
  }
  log("Quality gate passed.");
  return true;
}

interface SessionDelta {
  postSnapshot: ProgressSnapshot;
  completedItems: string[];
  blockedItems: string[];
  changedFiles: string[];
}

async function computeSessionDelta(preSnapshot: ProgressSnapshot): Promise<SessionDelta> {
  const postSnapshot = await captureSnapshot();
  const completedItems: string[] = [];
  const blockedItems: string[] = [];
  for (const [id, postState] of postSnapshot.itemStates) {
    const preState = preSnapshot.itemStates.get(id);
    if (postState === "done" && preState !== "done") completedItems.push(id);
    if (postState === "blocked" && preState !== "blocked") blockedItems.push(id);
  }

  let changedFiles: string[] = [];
  if (preSnapshot.headSha) {
    try {
      const p = Bun.spawnSync(
        ["git", "diff", "--name-only", preSnapshot.headSha, "HEAD"],
        { cwd: process.cwd() },
      );
      if (p.exitCode === 0) {
        changedFiles = p.stdout
          .toString()
          .trim()
          .split("\n")
          .filter((f) => f.trim());
      }
    } catch {}
  }

  return { postSnapshot, completedItems, blockedItems, changedFiles };
}

async function appendSessionLog(
  sessionNum: number,
  exitReason: string,
  sessionId: string | null,
  costUsd: number | null,
  delta: SessionDelta | null,
): Promise<void> {
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  const content = await Bun.file(PROGRESS_FILE).text();

  const inProgressItems = content
    .split("\n")
    .filter((l) => l.startsWith("- [~]"))
    .map((l) => l.replace(/^- \[~\] /, "  - "));

  const completedItems = delta?.completedItems ?? [];
  const blockedItems = delta?.blockedItems ?? [];
  const changedFiles = delta?.changedFiles ?? [];

  const costStr = costUsd !== null ? ` [cost: $${costUsd.toFixed(4)}]` : "";
  const entry = [
    "",
    `### Session ${sessionNum} (${ts}) [exit: ${exitReason}]${sessionId ? ` [session: ${sessionId}]` : ""}${costStr}`,
    ...(completedItems.length > 0 ? [`- Completed: ${completedItems.join(", ")}`] : []),
    ...(blockedItems.length > 0 ? [`- Blocked: ${blockedItems.join(", ")}`] : []),
    ...(inProgressItems.length > 0
      ? ["- Items in progress:", ...inProgressItems]
      : []),
    ...(changedFiles.length > 0
      ? [
          changedFiles.length <= 5
            ? `- Changed files: ${changedFiles.join(", ")}`
            : `- Changed files: ${changedFiles.slice(0, 5).join(", ")} (+${changedFiles.length - 5} more)`,
        ]
      : []),
    `- Exit reason: ${exitReason}`,
    "",
  ].join("\n");

  await Bun.write(PROGRESS_FILE, content + entry);
}

// === Cross-Session Intelligence ===
const SESSION_HANDOFF_FILE = resolve(config.loopDir, "SESSION_HANDOFF.md");
const LEARNINGS_FILE = resolve(config.loopDir, "LEARNINGS.md");
const LEARNINGS_MAX_LINES = 100;

async function generateSessionHandoff(
  sessionNum: number,
  delta: SessionDelta,
): Promise<void> {
  const completed = delta.completedItems;
  const changedFiles = delta.changedFiles;

  // Suggested next priority: first pending items whose deps are done
  const nextPending: string[] = [];
  const content = await Bun.file(PROGRESS_FILE).text();
  for (const line of content.split("\n")) {
    if (line.startsWith("- [ ]")) {
      const m = line.match(ITEM_RE);
      if (m && nextPending.length < 3) nextPending.push(m[2]);
    }
  }

  const lines = [
    `# Session ${sessionNum} Handoff`,
    ``,
    `## Completed This Session`,
    ...(completed.length > 0 ? completed.map((id) => `- ${id}`) : ["- (none)"]),
    ``,
    `## Key Files Changed`,
    ...(changedFiles.length > 0 ? changedFiles.map((f) => `- ${f}`) : ["- (none)"]),
    ``,
    `## Suggested Next Priority`,
    ...(nextPending.length > 0 ? nextPending.map((id) => `- ${id}`) : ["- (none remaining)"]),
    ``,
  ];

  await Bun.write(SESSION_HANDOFF_FILE, lines.join("\n"));
}

const LEARNINGS_TEMPLATE_LINES = [
  `# Loop Learnings`,
  ``,
  `Append discoveries here. Read at session start, append before exiting.`,
  ``,
  `## Environment`,
  ``,
  `## Patterns`,
  ``,
  `## Pitfalls`,
  ``,
];

async function initLearnings(): Promise<void> {
  if (existsSync(LEARNINGS_FILE)) return;
  await Bun.write(LEARNINGS_FILE, LEARNINGS_TEMPLATE_LINES.join("\n"));
}

async function truncateLearnings(): Promise<void> {
  if (!existsSync(LEARNINGS_FILE)) return;
  try {
    const content = await Bun.file(LEARNINGS_FILE).text();
    const lines = content.split("\n");
    if (lines.length <= LEARNINGS_MAX_LINES) return;

    // Keep header (template structure) + most recent content
    const header = lines.slice(0, LEARNINGS_TEMPLATE_LINES.length);
    const body = lines.slice(LEARNINGS_TEMPLATE_LINES.length);
    const keepCount = LEARNINGS_MAX_LINES - header.length;
    const truncatedBody = body.slice(-keepCount);

    // Find first section boundary for clean cut
    let cutIdx = 0;
    for (let i = 0; i < truncatedBody.length; i++) {
      if (truncatedBody[i].startsWith("## ")) {
        cutIdx = i;
        break;
      }
    }

    const result = [...header, ...truncatedBody.slice(cutIdx)];
    await Bun.write(LEARNINGS_FILE, result.join("\n"));
  } catch {}
}

// === Session Runner ===
interface SessionResult {
  exitReason: string;
  sessionId: string | null;
  activity: SessionActivityData;
}

async function runSession(sessionNum: number): Promise<SessionResult> {
  const sessionLog = resolve(LOG_DIR, `session-${sessionNum}.log`);
  const promptContent = await Bun.file(PROMPT_FILE).text();

  log(`Starting session ${sessionNum}...`);

  // Inject loop file paths so the agent can find them from any cwd
  const loopDirAbsolute = resolve(config.loopDir);

  const firstSessionBlock =
    sessionNum === 1
      ? [
          `## First Session`,
          `This is the first session. Before starting items:`,
          `1. Run verification commands to confirm the environment works.`,
          `2. Briefly explore the codebase structure relevant to VISION.md goals.`,
          `3. Then proceed to the first item.`,
          ``,
        ]
      : [];

  let handoffBlock: string[] = [];
  const handoffFile = resolve(loopDirAbsolute, "SESSION_HANDOFF.md");
  if (existsSync(handoffFile)) {
    try {
      const c = await Bun.file(handoffFile).text();
      if (c.trim()) handoffBlock = [`## Previous Session Handoff`, c.trim(), ``];
    } catch {}
  }

  const enrichedPrompt = [
    `## Loop Files`,
    `- PROGRESS.md: ${resolve(loopDirAbsolute, "PROGRESS.md")}`,
    `- VISION.md: ${resolve(loopDirAbsolute, "VISION.md")}`,
    `- Working directory: ${process.cwd()}`,
    ``,
    ...firstSessionBlock,
    ...handoffBlock,
    promptContent,
  ].join("\n");

  const proc = Bun.spawn(
    [
      "claude",
      "-p",
      enrichedPrompt,
      "--verbose",
      "--model",
      config.claudeModel,
      "--allowedTools",
      config.allowedTools,
      "--max-budget-usd",
      String(config.maxBudgetUsd),
      "--output-format",
      "stream-json",
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CLAUDECODE: undefined },
    },
  );

  activeProcess = proc;

  let sessionId: string | null = null;
  let lastActivityTime = Date.now();
  let exitReason = "normal";

  // Drain stderr to file
  const stderrLog = sessionLog + ".stderr";
  const stderrDrain = (async () => {
    if (!proc.stderr) return;
    const chunks: Uint8Array[] = [];
    const reader = proc.stderr.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (chunks.length > 0) {
      await Bun.write(stderrLog, new Blob(chunks as BlobPart[]));
    }
  })();

  // Idle timeout checker
  const idleCheck = setInterval(() => {
    const idleSecs = (Date.now() - lastActivityTime) / 1000;
    if (idleSecs > config.idleTimeout) {
      log(`WARNING: No activity for ${config.idleTimeout}s. Killing session.`);
      exitReason = "timeout";
      proc.kill("SIGTERM");
    }
  }, 10_000);

  // Process NDJSON events from stdout
  const eventLines: string[] = [];
  const activity: SessionActivityData = {
    toolUses: [],
    textSnippets: [],
    resultText: null,
    costUsd: null,
  };

  if (proc.stdout) {
    for await (const event of parseNDJSON(proc.stdout)) {
      lastActivityTime = Date.now();
      eventLines.push(JSON.stringify(event));

      // Session ID: handle both legacy "init" and SDK "system"+"init"
      if (event.type === "init") {
        sessionId = (event as StreamEventInit).session_id;
        log(`  Session ID: ${sessionId}`);
      } else if (
        event.type === "system" &&
        (event as StreamEventSystem).subtype === "init"
      ) {
        sessionId = (event as StreamEventSystem).session_id ?? null;
        if (sessionId) log(`  Session ID: ${sessionId}`);
      } else if (event.type === "assistant") {
        const msg = (event as StreamEventAssistant).message;
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === "tool_use") {
              activity.toolUses.push(block.name);
            } else if (block.type === "text" && block.text?.trim()) {
              activity.textSnippets.push(block.text.trim().slice(0, 120));
            }
          }
        }
      } else if (event.type === "result") {
        const r = event as StreamEventResult;
        const cost = r.cost_usd ?? r.total_cost_usd;
        if (cost !== undefined) {
          activity.costUsd = cost;
          log(`  Session cost: $${cost.toFixed(4)}`);
        }
        if (r.result) {
          activity.resultText = r.result;
        }
      }
    }
  }

  const exitCode = await proc.exited;
  await stderrDrain;
  clearInterval(idleCheck);
  activeProcess = null;

  // Write event log
  await Bun.write(sessionLog, eventLines.join("\n") + "\n");

  // Determine exit reason (if not already set by timeout)
  if (exitReason !== "timeout") {
    if (exitCode === 0) {
      exitReason = "normal";
    } else if (existsSync(stderrLog)) {
      const stderr = await Bun.file(stderrLog).text();
      exitReason = /budget/i.test(stderr) ? "budget-exceeded" : "error";
    } else {
      exitReason = "error";
    }
  }

  return { exitReason, sessionId, activity };
}

// === Loop Summary ===
async function runSummarySession(loopStartSha: string): Promise<void> {
  if (!config.summaryEnabled) return;

  log("=== Running Loop Summary Session ===");

  // Capture git diff from loop start
  let gitDiff = "";
  if (loopStartSha) {
    try {
      const statProc = Bun.spawnSync(
        ["git", "diff", loopStartSha, "--stat", "--no-color"],
        { cwd: process.cwd() },
      );
      if (statProc.exitCode === 0) {
        gitDiff = statProc.stdout.toString().trim();
      }
      const fullDiffProc = Bun.spawnSync(
        ["git", "diff", loopStartSha, "--no-color"],
        { cwd: process.cwd() },
      );
      if (fullDiffProc.exitCode === 0) {
        const fullDiff = fullDiffProc.stdout.toString();
        const diffLines = fullDiff.split("\n").slice(0, 200);
        if (fullDiff.split("\n").length > 200) diffLines.push("... (truncated)");
        const diffContent = diffLines.join("\n").trim();
        if (diffContent) {
          gitDiff += "\n\n" + diffLines.join("\n");
        }
      }
    } catch {
      gitDiff = "(git diff unavailable)";
    }
  }

  // Read final PROGRESS.md
  let progressContent = "";
  try {
    progressContent = await Bun.file(PROGRESS_FILE).text();
  } catch {
    progressContent = "(PROGRESS.md unavailable)";
  }

  const summaryPrompt = [
    "You are summarizing the results of an autonomous coding loop that just finished.",
    "Provide a concise summary (3-10 bullet points) covering:",
    "- What was accomplished (completed items from PROGRESS.md)",
    "- What was left unfinished or blocked",
    "- Key files/code changed (from git diff)",
    "- Any notable patterns or issues observed",
    "",
    "## Final PROGRESS.md",
    progressContent.slice(0, 3000),
    ...(progressContent.length > 3000 ? ["... (truncated)"] : []),
    "",
    "## Git Diff Summary (since loop start)",
    gitDiff || "(no changes detected)",
  ].join("\n");

  const proc = Bun.spawn(
    [
      "claude",
      "-p",
      summaryPrompt,
      "--model",
      config.claudeModel,
      "--max-budget-usd",
      String(config.summaryBudgetUsd),
    ],
    {
      cwd: process.cwd(),
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env, CLAUDECODE: undefined },
    },
  );
  activeProcess = proc;

  const exitCode = await proc.exited;
  activeProcess = null;
  if (exitCode !== 0) {
    log("WARNING: Summary session exited with non-zero code");
  }
}

// === Main ===
async function main(): Promise<void> {
  // Preflight
  if (Bun.spawnSync(["which", "claude"]).exitCode !== 0) {
    log("ERROR: claude CLI not found in PATH");
    process.exit(1);
  }
  if (!existsSync(PROGRESS_FILE)) {
    log(`ERROR: Progress file not found: ${PROGRESS_FILE}`);
    process.exit(1);
  }
  if (!existsSync(PROMPT_FILE)) {
    log(`ERROR: Prompt file not found: ${PROMPT_FILE}`);
    process.exit(1);
  }
  mkdirSync(LOG_DIR, { recursive: true });

  // Capture HEAD SHA before loop starts (for summary diff)
  let loopStartSha = "";
  try {
    const shaProc = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
      cwd: process.cwd(),
    });
    if (shaProc.exitCode === 0) {
      loopStartSha = shaProc.stdout.toString().trim();
    }
  } catch {
    // not a git repo — summary will skip git diff
  }

  log("=== Loop Harness Starting ===");
  log(
    `Dir: ${config.loopDir} | Model: ${config.claudeModel} | Budget: $${config.maxBudgetUsd}/session`,
  );
  log(
    `Max sessions: ${config.maxSessions} | Idle timeout: ${config.idleTimeout}s | Cooldown: ${config.cooldownSecs}s`,
  );

  let sessionCount = 0;
  let zeroItemRuns = 0;
  let preGraceTotal = 0;
  let consecutiveQualityFailures = 0;
  const verifyCommands = config.qualityGate ? await parseVerifyCommands() : [];

  await initLearnings();

  while (true) {
    if (stopState !== "running") {
      log("Stop requested (SIGINT). Halting loop.");
      break;
    }
    if (existsSync(STOP_FILE)) {
      log("STOP file detected. Halting loop.");
      break;
    }
    if (sessionCount >= config.maxSessions) {
      log(`Reached max sessions (${config.maxSessions}). Halting loop.`);
      break;
    }

    const progress = await parseProgress();
    log(
      `Progress: pending=${progress.pending} in-progress=${progress.inProgress} done=${progress.done} blocked=${progress.blocked}`,
    );

    if (progress.pending === 0 && progress.inProgress === 0) {
      // Distinguish all-done from all-blocked
      if (progress.blocked > 0) {
        log(
          `Remaining items are blocked (${progress.done} done, ${progress.blocked} blocked). Halting loop.`,
        );
        break;
      }

      // Grace session for discovery
      zeroItemRuns++;
      if (zeroItemRuns >= 2) {
        log("No pending or in-progress items after grace session. Loop complete.");
        break;
      }
      preGraceTotal =
        progress.pending + progress.inProgress + progress.done + progress.blocked;
      log("No pending or in-progress items. Running grace session for discovery...");
    } else {
      zeroItemRuns = 0;
    }

    if (config.dryRun) {
      log(`DRY_RUN=1. Would start session ${sessionCount + 1}. Exiting.`);
      break;
    }

    sessionCount++;
    const preSnapshot = await captureSnapshot();
    const result = await runSession(sessionCount);

    log(
      `Session ${sessionCount} exited [${result.exitReason}]${result.sessionId ? ` (session: ${result.sessionId})` : ""}`,
    );

    // Show human-readable session summary
    log("--- Session Summary ---");
    console.log(formatSessionSummary(result.activity));
    log("---");

    const delta = await computeSessionDelta(preSnapshot);
    await appendSessionLog(
      sessionCount, result.exitReason, result.sessionId,
      result.activity.costUsd, delta,
    );

    // Generate cross-session intelligence files
    await generateSessionHandoff(sessionCount, delta);
    await truncateLearnings();

    // Run between-session quality gate
    if (verifyCommands.length > 0) {
      const passed = await runQualityGate(verifyCommands);
      if (passed) {
        consecutiveQualityFailures = 0;
      } else {
        consecutiveQualityFailures++;
        if (consecutiveQualityFailures >= 2) {
          log("Quality gate failed 2 consecutive times. Halting loop.");
          break;
        }
        log(`Quality gate failed (${consecutiveQualityFailures}/2 consecutive). Continuing...`);
      }
    }

    // Check if grace session produced new items
    if (zeroItemRuns === 1) {
      const postGrace = await parseProgress();
      const postGraceTotal =
        postGrace.pending + postGrace.inProgress + postGrace.done + postGrace.blocked;
      if (postGraceTotal <= preGraceTotal) {
        log("Grace session produced no new items. Halting loop immediately.");
        break;
      }
    }

    if (config.cooldownSecs > 0) {
      log(`Cooling down for ${config.cooldownSecs}s...`);
      await Bun.sleep(config.cooldownSecs * 1000);
    }
  }

  // Summary
  const final = await parseProgress();
  log("=== Loop Finished ===");
  log(
    `Sessions: ${sessionCount} | Done: ${final.done} | Blocked: ${final.blocked} | Pending: ${final.pending}`,
  );
  log(`Logs: ${LOG_DIR}/`);

  // Run optional loop summary session (skip if user requested stop)
  if (sessionCount > 0 && stopState === "running") {
    await runSummarySession(loopStartSha);
  }
}

main().catch((e) => {
  log(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
