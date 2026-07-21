#!/usr/bin/env bun
/**
 * resolve-session.ts — Resolve current Claude session JSONL path
 *
 * Strategy: PPID → ~/.claude/sessions/<PID>.json → sessionId, then:
 *   1. Direct path: escape cwd "/" → "-", check <sessionId>.jsonl directly
 *   2. Index lookup: check sessions-index.json for fullPath
 *   3. Fallback: scan all project dirs for the JSONL file or index match
 *
 * Output: absolute path to .jsonl file on stdout, or empty + stderr warning
 */

import { readdir } from "node:fs/promises";

// Claude Code の設定ディレクトリ。mise 等で CLAUDE_CONFIG_DIR が分離されている場合はそれに従い、
// 未設定なら従来どおり ~/.claude にフォールバックする。
function claudeConfigDir(home: string): string {
  return process.env.CLAUDE_CONFIG_DIR || `${home}/.claude`;
}

async function findInIndex(indexPath: string, sessionId: string): Promise<string | null> {
  const file = Bun.file(indexPath);
  if (!(await file.exists())) return null;
  const index = await file.json();
  const entry = (index.entries as { sessionId: string; fullPath: string }[])?.find(
    (e) => e.sessionId === sessionId,
  );
  return entry?.fullPath ?? null;
}

async function findClaudePid(): Promise<number | null> {
  // Walk up the process tree: bun → bash → claude
  // process.ppid gives bash, we need bash's parent (claude)
  let pid = process.ppid;
  const home = process.env.HOME;
  if (!home) return null;
  const configDir = claudeConfigDir(home);

  // Check if current ppid has a session file (bash case won't)
  for (let depth = 0; depth < 3; depth++) {
    const sessionFile = Bun.file(`${configDir}/sessions/${pid}.json`);
    if (await sessionFile.exists()) return pid;

    // Walk up: read ppid from /proc or ps
    const proc = Bun.spawn(["ps", "-o", "ppid=", "-p", String(pid)], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = (await new Response(proc.stdout).text()).trim();
    await proc.exited;
    const parentPid = parseInt(output, 10);
    if (isNaN(parentPid) || parentPid <= 1) return null;
    pid = parentPid;
  }
  return null;
}

async function main() {
  const home = process.env.HOME;
  if (!home) {
    console.error("⚠ HOME environment variable is not set");
    process.exit(0);
  }
  const configDir = claudeConfigDir(home);
  const projectsDir = `${configDir}/projects`;

  // Step 1: Find claude PID by walking process tree
  const claudePid = await findClaudePid();
  if (!claudePid) {
    console.error("⚠ Claude セッションプロセスが見つかりません");
    process.exit(0);
  }

  const pidFile = Bun.file(`${configDir}/sessions/${claudePid}.json`);
  if (!(await pidFile.exists())) {
    console.error(`⚠ セッションPIDファイルが見つかりません (PID: ${claudePid})`);
    process.exit(0);
  }
  const { sessionId, cwd } = (await pidFile.json()) as {
    sessionId: string;
    cwd: string;
  };

  // Step 2: Fast path — escape cwd "/" → "-", check JSONL directly
  // This works for in-progress sessions that aren't yet in sessions-index.json
  const escapedPath = cwd.replace(/\//g, "-");
  const directPath = `${projectsDir}/${escapedPath}/${sessionId}.jsonl`;
  if (await Bun.file(directPath).exists()) {
    console.log(directPath);
    return;
  }

  // Step 3: Index lookup (for completed sessions with potentially different escaping)
  const indexResult = await findInIndex(
    `${projectsDir}/${escapedPath}/sessions-index.json`,
    sessionId,
  );
  if (indexResult) {
    console.log(indexResult);
    return;
  }

  // Step 4: Fallback — scan all project dirs
  const dirs = await readdir(projectsDir).catch(() => [] as string[]);
  for (const dir of dirs) {
    // Check direct JSONL path
    const jsonlPath = `${projectsDir}/${dir}/${sessionId}.jsonl`;
    if (await Bun.file(jsonlPath).exists()) {
      console.log(jsonlPath);
      return;
    }
    // Check sessions-index.json
    const result = await findInIndex(`${projectsDir}/${dir}/sessions-index.json`, sessionId);
    if (result) {
      console.log(result);
      return;
    }
  }

  console.error(`⚠ セッション ${sessionId} がインデックスに見つかりません`);
}

main();
