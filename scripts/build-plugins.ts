import { Glob } from "bun";
import { rm, mkdir } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const pluginsDir = resolve(rootDir, "plugins");

async function getPluginDirs(): Promise<string[]> {
  const dirs: string[] = [];
  const glob = new Glob("*/src");
  for await (const match of glob.scan({ cwd: pluginsDir, onlyFiles: false })) {
    dirs.push(dirname(resolve(pluginsDir, match)));
  }
  return dirs;
}

async function buildPlugin(pluginDir: string): Promise<void> {
  const pluginName = relative(pluginsDir, pluginDir);
  const srcDir = resolve(pluginDir, "src");
  const distDir = resolve(pluginDir, "dist");

  const entrypoints: string[] = [];
  const glob = new Glob("**/*.ts");
  for await (const match of glob.scan({ cwd: srcDir })) {
    entrypoints.push(resolve(srcDir, match));
  }

  if (entrypoints.length === 0) {
    console.log(`[${pluginName}] No TypeScript files found in src/, skipping`);
    return;
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const result = await Bun.build({
    entrypoints,
    outdir: distDir,
    root: srcDir,
    target: "bun",
    format: "esm",
  });

  if (!result.success) {
    console.error(`[${pluginName}] Build failed:`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log(
    `[${pluginName}] Built ${result.outputs.length} file(s) → dist/`
  );
}

async function main(): Promise<void> {
  const pluginDirs = await getPluginDirs();

  if (pluginDirs.length === 0) {
    console.log("No plugins with src/ directories found, nothing to build.");
    return;
  }

  for (const dir of pluginDirs) {
    await buildPlugin(dir);
  }
}

main();
