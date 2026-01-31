import { Glob } from "bun";
import { resolve } from "node:path";
import { $ } from "bun";

const rootDir = resolve(import.meta.dirname, "..");
const packagesDir = resolve(rootDir, "packages");

async function getPackageDirsWithRslib(): Promise<string[]> {
  const dirs: string[] = [];
  const glob = new Glob("*/rslib.config.ts");
  for await (const match of glob.scan({ cwd: packagesDir })) {
    dirs.push(resolve(packagesDir, match, ".."));
  }
  return dirs;
}

async function main(): Promise<void> {
  const packageDirs = await getPackageDirsWithRslib();

  if (packageDirs.length === 0) {
    console.log(
      "No packages with rslib.config.ts found, nothing to build.",
    );
    return;
  }

  for (const dir of packageDirs) {
    const name = dir.split("/").pop();
    console.log(`[${name}] Building with rslib...`);
    await $`rslib build`.cwd(dir);
    console.log(`[${name}] Done.`);
  }
}

main();
