// @bun
// plugins/dev-workflow/src/hooks/plan-tracker.ts
import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync
} from "fs";
import { resolve, join, dirname } from "path";
import { homedir } from "os";
var PLANS_DIR = resolve(homedir(), ".claude/plans");
function getProjectKey() {
  return process.cwd().replace(/\//g, "_-_");
}
function getIndexPath() {
  const projectDir = resolve(homedir(), ".claude/projects", getProjectKey());
  return resolve(projectDir, "plan-index.json");
}
function loadIndex(indexPath) {
  if (!existsSync(indexPath)) {
    return { version: 1, lastChecked: "", entries: [] };
  }
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return { version: 1, lastChecked: "", entries: [] };
  }
}
function extractTitle(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8").slice(0, 500);
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";
  } catch {
    return filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";
  }
}
function extractMetadata(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8").slice(0, 2000);
    const headings = content.match(/^#{2,3}\s+/gm);
    const stepCount = headings ? headings.length : undefined;
    const hasDesignDecisions = /Why:\s/m.test(content) || /\u65B9\u91DD|\u8A2D\u8A08\u5224\u65AD|Design Decision|\u30A2\u30FC\u30AD\u30C6\u30AF\u30C1\u30E3|architecture/im.test(content) || undefined;
    return { stepCount, hasDesignDecisions };
  } catch {
    return {};
  }
}
function main() {
  if (!existsSync(PLANS_DIR))
    return;
  const indexPath = getIndexPath();
  const index = loadIndex(indexPath);
  const lastCheckedMs = index.lastChecked ? new Date(index.lastChecked).getTime() : 0;
  const existingSlugs = new Set(index.entries.map((e) => e.slug));
  const files = readdirSync(PLANS_DIR);
  const newEntries = [];
  for (const file of files) {
    if (!file.endsWith(".md"))
      continue;
    const fullPath = join(PLANS_DIR, file);
    const slug = file.replace(/\.md$/, "");
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.mtimeMs <= lastCheckedMs)
      continue;
    if (existingSlugs.has(slug)) {
      const existing = index.entries.find((e) => e.slug === slug);
      if (existing) {
        existing.fileModified = stat.mtime.toISOString();
        existing.title = extractTitle(fullPath);
        Object.assign(existing, extractMetadata(fullPath));
      }
      continue;
    }
    newEntries.push({
      filePath: fullPath,
      title: extractTitle(fullPath),
      fileModified: stat.mtime.toISOString(),
      detectedAt: new Date().toISOString(),
      slug,
      ...extractMetadata(fullPath)
    });
  }
  index.entries.push(...newEntries);
  index.lastChecked = new Date().toISOString();
  mkdirSync(dirname(indexPath), { recursive: true });
  const tmpPath = indexPath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(index, null, 2));
  renameSync(tmpPath, indexPath);
}
try {
  main();
} catch {}
