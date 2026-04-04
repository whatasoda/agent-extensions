#!/usr/bin/env bun
import { Glob } from "bun";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, chmodSync } from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dir, "..");
const DIST = path.join(ROOT, "dist");

// 1. Clean dist/
rmSync(DIST, { recursive: true, force: true });

// 2. Transpile src/ (excluding tests)
const srcTranspiler = new Bun.Transpiler({ loader: "tsx" });
const srcGlob = new Glob("**/*.{ts,tsx}");

let transpiled = 0;
for await (const file of srcGlob.scan({ cwd: path.join(ROOT, "src"), absolute: false })) {
  if (file.includes(".test.")) continue;

  const inputPath = path.join(ROOT, "src", file);
  const outputPath = path.join(DIST, "src", file.replace(/\.tsx?$/, ".js"));

  mkdirSync(path.dirname(outputPath), { recursive: true });
  const code = readFileSync(inputPath, "utf-8");
  const result = srcTranspiler.transformSync(code);
  writeFileSync(outputPath, result);
  transpiled++;
}

// 3. Prepend shebang to cli.js
const cliPath = path.join(DIST, "src", "cli.js");
const cliContent = readFileSync(cliPath, "utf-8");
writeFileSync(cliPath, `#!/usr/bin/env bun\n${cliContent}`);
chmodSync(cliPath, 0o755);

// 4. Transpile scripts/
const scriptsTranspiler = new Bun.Transpiler({ loader: "ts" });
const scriptsGlob = new Glob("*.ts");

for await (const file of scriptsGlob.scan({ cwd: path.join(ROOT, "scripts"), absolute: false })) {
  if (file === "build.ts") continue; // Don't include the build script itself

  const inputPath = path.join(ROOT, "scripts", file);
  const outputPath = path.join(DIST, "scripts", file.replace(/\.ts$/, ".js"));

  mkdirSync(path.dirname(outputPath), { recursive: true });
  const code = readFileSync(inputPath, "utf-8");
  const result = scriptsTranspiler.transformSync(code);
  writeFileSync(outputPath, result);
  transpiled++;
}

// 5. Copy static files
// skills/
cpSync(path.join(ROOT, "skills"), path.join(DIST, "skills"), { recursive: true });

// agents/
cpSync(path.join(ROOT, "agents"), path.join(DIST, "agents"), { recursive: true });

// schema.sql
cpSync(path.join(ROOT, "src", "core", "schema.sql"), path.join(DIST, "src", "core", "schema.sql"));

console.log(`Build complete: ${transpiled} files transpiled to dist/`);
