#!/usr/bin/env bun
import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const pkgDir = path.resolve(import.meta.dir, "../packages/soda");
const pkgJsonPath = path.join(pkgDir, "package.json");

// Generate timestamp version: YYMMDDHHmm
const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const timestamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

// Read and patch version
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
const originalVersion = pkgJson.version;
const [major, minor] = originalVersion.split(".");
const localVersion = `${major}.${minor}.${timestamp}-local`;

pkgJson.version = localVersion;
writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");

console.log(`Version: ${originalVersion} → ${localVersion}`);

try {
  // Build and publish with "local" dist-tag
  await $`cd ${pkgDir} && bun run build`.quiet();
  console.log("Build complete");

  const publishArgs = ["publish", "--access", "public", "--tag", "local"];
  const otp = process.argv[2];
  if (otp) publishArgs.push("--otp", otp);
  const result = Bun.spawnSync(["npm", ...publishArgs], { cwd: pkgDir, stdio: ["inherit", "inherit", "inherit"] });
  if (result.exitCode !== 0) {
    throw new Error(`npm publish failed with exit code ${result.exitCode}`);
  }
  console.log(`\nPublished @whatasoda/agent-tools@${localVersion}`);
  console.log(`Install: sd update local`);
} finally {
  // Restore original version
  pkgJson.version = originalVersion;
  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
}
