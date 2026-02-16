#!/usr/bin/env bun
/**
 * Copy a template file and make it executable.
 *
 * Usage:
 *   bun install-template.ts <source-path> <target-path>
 *
 * Output (JSON):
 *   {
 *     "copied": true,
 *     "target": "/abs/path/to/target"
 *   }
 */

import { chmodSync } from "node:fs";
import { resolve } from "node:path";

interface Output {
  copied: boolean;
  target: string;
}

interface ErrorOutput {
  error: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    const error: ErrorOutput = {
      error: "Usage: bun install-template.ts <source-path> <target-path>",
    };
    console.log(JSON.stringify(error));
    process.exit(1);
  }

  const sourcePath = resolve(args[0]);
  const targetPath = resolve(args[1]);

  const sourceFile = Bun.file(sourcePath);
  if (!(await sourceFile.exists())) {
    const error: ErrorOutput = {
      error: `Source file not found: ${sourcePath}`,
    };
    console.log(JSON.stringify(error));
    process.exit(1);
  }

  const buffer = await sourceFile.arrayBuffer();
  await Bun.write(targetPath, buffer);
  chmodSync(targetPath, 0o755);

  const output: Output = {
    copied: true,
    target: targetPath,
  };

  console.log(JSON.stringify(output));
}

main();
