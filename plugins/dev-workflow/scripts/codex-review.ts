#!/usr/bin/env bun
/**
 * codex-review.ts - Codex plan review wrapper
 *
 * Consolidates temp file creation, content writing, and codex execution
 * into a single Bash command to minimize permission prompts.
 *
 * Usage:
 *   # Initial review (reads content from stdin, creates temp file)
 *   bun codex-review.ts init "instruction" [--ref <path>] < content
 *
 *   # Initial review (uses existing file directly)
 *   bun codex-review.ts init "instruction" --file <path> [--ref <path>]
 *
 *   # Resume review (reads updated content from stdin)
 *   bun codex-review.ts resume <session-id> <review-file> "instruction" [--ref <path>] < content
 *
 *   # Resume review (re-reads existing file)
 *   bun codex-review.ts resume <session-id> <review-file> "instruction" [--ref <path>]
 *
 * Output (init mode):
 *   review_file: /tmp/codex-review-XXXXX/review.md
 *   session_id: <extracted from codex output>
 *   ---
 *   <codex review output>
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isatty } from "node:tty";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const mode = args[0] as "init" | "resume" | undefined;

  if (!mode || !["init", "resume"].includes(mode)) {
    return null;
  }

  const flagIdx = (name: string) => args.indexOf(name);

  const refIdx = flagIdx("--ref");
  const refPath = refIdx !== -1 ? args[refIdx + 1] : undefined;

  const fileIdx = flagIdx("--file");
  const filePath = fileIdx !== -1 ? args[fileIdx + 1] : undefined;

  const flagIndices = new Set<number>();
  if (refIdx !== -1) {
    flagIndices.add(refIdx);
    flagIndices.add(refIdx + 1);
  }
  if (fileIdx !== -1) {
    flagIndices.add(fileIdx);
    flagIndices.add(fileIdx + 1);
  }
  const positional = args.filter((_, i) => !flagIndices.has(i));

  if (mode === "init") {
    return { mode, instruction: positional[1], refPath, filePath } as const;
  } else {
    return {
      mode,
      sessionId: positional[1],
      reviewFile: positional[2],
      instruction: positional[3],
      refPath,
      filePath,
    } as const;
  }
}

async function readStdin(): Promise<string> {
  if (isatty(0)) return "";
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function getRefPath(refPath?: string): Promise<string> {
  if (refPath) return refPath;
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const repoRoot = (await new Response(proc.stdout).text()).trim();
  const exitCode = await proc.exited;
  if (exitCode !== 0 || !repoRoot) {
    return "CLAUDE.md";
  }
  return `${repoRoot}/CLAUDE.md`;
}

async function runCodex(
  args: string[]
): Promise<{ output: string; exitCode: number }> {
  const proc = Bun.spawn(["codex", ...args], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  return { output, exitCode };
}

function extractSessionId(output: string): string | null {
  const match = output.match(/session id:\s*(\S+)/i);
  return match ? match[1] : null;
}

function printUsage() {
  console.error("Usage:");
  console.error(
    '  bun codex-review.ts init "instruction" [--file <path>] [--ref <path>]'
  );
  console.error(
    '  bun codex-review.ts resume <session-id> <review-file> "instruction" [--ref <path>]'
  );
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    printUsage();
    process.exit(1);
  }

  const refPath = await getRefPath(parsed.refPath);

  if (parsed.mode === "init") {
    if (!parsed.instruction) {
      printUsage();
      process.exit(1);
    }

    let reviewFile: string;

    if (parsed.filePath) {
      reviewFile = parsed.filePath;
    } else {
      const content = await readStdin();
      if (!content.trim()) {
        console.error("⚠ codex レビューをスキップします（入力なし）");
        process.exit(0);
      }
      const tmpDir = await mkdtemp(join(tmpdir(), "codex-review-"));
      reviewFile = join(tmpDir, "review.md");
      await writeFile(reviewFile, content);
    }

    const prompt = `${parsed.instruction}: ${reviewFile} (ref: ${refPath})`;

    try {
      const { output, exitCode } = await runCodex([
        "exec",
        "-m",
        "gpt-5.3-codex",
        prompt,
      ]);

      if (exitCode !== 0) {
        if (exitCode === 126 || exitCode === 127) {
          console.error(
            `⚠ codex レビューをスキップします（codex コマンドが見つからない、または実行権限がありません — exit code: ${exitCode}）`
          );
        } else {
          console.error(
            `⚠ codex レビューをスキップします（コマンド実行失敗 — exit code: ${exitCode}）`
          );
        }
        console.log(`review_file: ${reviewFile}`);
        process.exit(0);
      }

      const sessionId = extractSessionId(output);
      console.log(`review_file: ${reviewFile}`);
      if (sessionId) {
        console.log(`session_id: ${sessionId}`);
      }
      console.log("---");
      console.log(output);
    } catch {
      console.error("⚠ codex レビューをスキップします（コマンド実行失敗）");
      console.log(`review_file: ${reviewFile}`);
      process.exit(0);
    }
  } else if (parsed.mode === "resume") {
    if (!parsed.sessionId || !parsed.reviewFile || !parsed.instruction) {
      printUsage();
      process.exit(1);
    }

    const content = await readStdin();
    if (content.trim()) {
      await writeFile(parsed.reviewFile, content);
    }

    const prompt = `${parsed.instruction}: ${parsed.reviewFile} (ref: ${refPath})`;

    try {
      const { output, exitCode } = await runCodex([
        "exec",
        "resume",
        "-m",
        "gpt-5.3-codex",
        parsed.sessionId,
        prompt,
      ]);

      if (exitCode !== 0) {
        if (exitCode === 126 || exitCode === 127) {
          console.error(
            `⚠ codex 再レビューをスキップします（codex コマンドが見つからない、または実行権限がありません — exit code: ${exitCode}）`
          );
        } else {
          console.error(
            `⚠ codex 再レビューをスキップします（コマンド実行失敗 — exit code: ${exitCode}）`
          );
        }
        process.exit(0);
      }

      console.log(output);
    } catch {
      console.error(
        "⚠ codex 再レビューをスキップします（コマンド実行失敗）"
      );
      process.exit(0);
    }
  }
}

main();
