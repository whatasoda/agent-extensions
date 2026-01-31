import { Glob } from "bun";
import { resolve } from "node:path";
import { $ } from "bun";
import { syncExports, collectPackageDirs } from "../packages/sync-exports/src/index";

const rootDir = resolve(import.meta.dirname, "..");

async function getPackageDirsWithRslib(): Promise<string[]> {
  const dirs: string[] = [];
  const packagesDir = resolve(rootDir, "packages");
  const glob = new Glob("*/rslib.config.ts");
  for await (const match of glob.scan({ cwd: packagesDir })) {
    dirs.push(resolve(packagesDir, match, ".."));
  }
  return dirs;
}

async function main(): Promise<void> {
  // Phase 1: sync exports for all packages
  console.log("=== Syncing exports ===");
  const { packages } = await collectPackageDirs(rootDir);
  for (const { dirName, packageDir } of packages) {
    console.log(`[${dirName}] Syncing exports...`);
    await syncExports({ packageDir });
  }

  // Phase 2: rslib build
  console.log("\n=== Building packages ===");
  const rslibDirs = await getPackageDirsWithRslib();

  if (rslibDirs.length === 0) {
    console.log("No packages with rslib.config.ts found, nothing to build.");
    return;
  }

  for (const dir of rslibDirs) {
    const name = dir.split("/").pop();
    console.log(`[${name}] Building with rslib...`);
    await $`rslib build`.cwd(dir);
    console.log(`[${name}] Done.`);
  }
}

main();
