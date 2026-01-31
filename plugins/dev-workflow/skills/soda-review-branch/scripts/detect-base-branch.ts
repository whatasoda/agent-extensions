#!/usr/bin/env bun
/**
 * Detect base branch and calculate changes from merge-base
 *
 * Usage:
 *   bun detect-base-branch.ts
 *
 * Output (JSON):
 *   {
 *     "baseBranch": "main",
 *     "mergeBase": "abc1234",
 *     "source": "pr" | "detected",
 *     "yourCommits": 5,
 *     "baseAhead": 3,
 *     "changedFiles": [...],
 *     "potentialConflicts": [...],
 *     "commands": { "diff": "...", "log": "..." }
 *   }
 */

import { $ } from "bun";

interface ChangedFile {
  status: string;
  file: string;
  oldFile?: string;
}

interface Output {
  baseBranch: string;
  mergeBase: string;
  source: "pr" | "detected";
  yourCommits: number;
  baseAhead: number;
  changedFiles: ChangedFile[];
  potentialConflicts: string[];
  commands: {
    diff: string;
    log: string;
  };
}

interface ErrorResult {
  error: string;
}

// Base branch patterns (order matters for priority)
const BASE_BRANCH_PATTERNS = ["release/*", "epic/*", "main"];

async function getCurrentBranch(): Promise<string> {
  const result = await $`git branch --show-current`.text();
  return result.trim();
}

async function getPRBaseBranch(): Promise<string | null> {
  try {
    const result = await $`gh pr view --json baseRefName -q .baseRefName`.text();
    const branch = result.trim();
    return branch || null;
  } catch {
    return null;
  }
}

async function getRemoteBranches(): Promise<string[]> {
  const result = await $`git branch -r --format='%(refname:short)'`.text();
  return result
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((b) => b.replace(/^origin\//, ""));
}

async function getMergeBase(branch: string): Promise<string | null> {
  try {
    // Try with origin/ prefix first, then local
    let result: string;
    try {
      result = await $`git merge-base HEAD origin/${branch}`.text();
    } catch {
      result = await $`git merge-base HEAD ${branch}`.text();
    }
    return result.trim() || null;
  } catch {
    return null;
  }
}

async function getCommitCount(from: string, to: string): Promise<number> {
  try {
    const result = await $`git rev-list --count ${from}..${to}`.text();
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function getChangedFiles(mergeBase: string): Promise<ChangedFile[]> {
  const result = await $`git diff --name-status ${mergeBase}..HEAD`.text();
  const lines = result.trim().split("\n").filter(Boolean);

  return lines.map((line) => {
    const parts = line.split("\t");
    const status = parts[0];

    // Handle renames (R100, R090, etc.) and copies (C100, etc.)
    if (status.startsWith("R") || status.startsWith("C")) {
      return {
        status: status[0],
        oldFile: parts[1],
        file: parts[2],
      };
    }

    return {
      status: status[0],
      file: parts[1],
    };
  });
}

async function getBaseChangedFiles(
  mergeBase: string,
  baseBranch: string
): Promise<string[]> {
  try {
    let result: string;
    try {
      result =
        await $`git diff --name-only ${mergeBase}..origin/${baseBranch}`.text();
    } catch {
      result =
        await $`git diff --name-only ${mergeBase}..${baseBranch}`.text();
    }
    return result.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function detectConflicts(
  yourFiles: ChangedFile[],
  baseFiles: string[]
): string[] {
  const yourFileSet = new Set<string>();
  for (const f of yourFiles) {
    yourFileSet.add(f.file);
    if (f.oldFile) {
      yourFileSet.add(f.oldFile);
    }
  }
  return baseFiles.filter((f) => yourFileSet.has(f));
}

async function findNearestBaseBranch(
  candidates: string[]
): Promise<{ branch: string; mergeBase: string } | null> {
  let nearest: { branch: string; mergeBase: string; distance: number } | null =
    null;

  for (const branch of candidates) {
    const mergeBase = await getMergeBase(branch);
    if (!mergeBase) continue;

    // Distance = number of commits from merge-base to HEAD
    const distance = await getCommitCount(mergeBase, "HEAD");

    if (nearest === null || distance < nearest.distance) {
      nearest = { branch, mergeBase, distance };
    }
  }

  return nearest ? { branch: nearest.branch, mergeBase: nearest.mergeBase } : null;
}

async function findBaseBranchCandidates(): Promise<string[]> {
  const remoteBranches = await getRemoteBranches();
  const candidates: string[] = [];

  for (const pattern of BASE_BRANCH_PATTERNS) {
    if (pattern.includes("*")) {
      // Glob pattern - find matching branches
      const prefix = pattern.replace("/*", "/");
      const matches = remoteBranches.filter((b) => b.startsWith(prefix));
      candidates.push(...matches);
    } else {
      // Exact match
      if (remoteBranches.includes(pattern)) {
        candidates.push(pattern);
      }
    }
  }

  return candidates;
}

async function main(): Promise<void> {
  const currentBranch = await getCurrentBranch();

  // Check if on a base branch itself
  const isBaseBranch = BASE_BRANCH_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const prefix = pattern.replace("/*", "/");
      return currentBranch.startsWith(prefix);
    }
    return currentBranch === pattern;
  });

  if (isBaseBranch || currentBranch === "") {
    const result: ErrorResult = {
      error: `Cannot detect changes: currently on base branch "${currentBranch || "detached HEAD"}"`,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Try to get base branch from PR first
  let baseBranch = await getPRBaseBranch();
  let source: "pr" | "detected" = "pr";

  let detectedMergeBase: string | null = null;

  if (!baseBranch) {
    // No PR - find nearest base branch
    source = "detected";
    const candidates = await findBaseBranchCandidates();
    const nearest = await findNearestBaseBranch(candidates);

    if (nearest) {
      baseBranch = nearest.branch;
      detectedMergeBase = nearest.mergeBase;
    } else {
      // Fallback to main
      baseBranch = "main";
    }
  }

  // Calculate merge-base (reuse from detection if available)
  const mergeBase = detectedMergeBase ?? (await getMergeBase(baseBranch));

  if (!mergeBase) {
    const result: ErrorResult = {
      error: `Cannot find merge-base with "${baseBranch}"`,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Get commit counts
  const yourCommits = await getCommitCount(mergeBase, "HEAD");
  let baseAhead = await getCommitCount(mergeBase, `origin/${baseBranch}`);
  // Fallback to local branch if remote returned 0 (may not exist)
  if (baseAhead === 0) {
    const localBaseAhead = await getCommitCount(mergeBase, baseBranch);
    if (localBaseAhead > 0) {
      baseAhead = localBaseAhead;
    }
  }

  // Get changed files
  const changedFiles = await getChangedFiles(mergeBase);
  const baseChangedFiles = await getBaseChangedFiles(mergeBase, baseBranch);

  // Detect potential conflicts
  const potentialConflicts = detectConflicts(changedFiles, baseChangedFiles);

  const output: Output = {
    baseBranch,
    mergeBase: mergeBase.substring(0, 7),
    source,
    yourCommits,
    baseAhead,
    changedFiles,
    potentialConflicts,
    commands: {
      diff: `git diff ${mergeBase.substring(0, 7)}..HEAD`,
      log: `git log --oneline ${mergeBase.substring(0, 7)}..HEAD`,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((e) => {
  const result: ErrorResult = {
    error: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
});
