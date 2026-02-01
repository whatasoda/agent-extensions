import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { homedir } from "node:os";

interface PlanIndexEntry {
  filePath: string;
  title: string;
  fileModified: string;
  detectedAt: string;
  slug: string;
}

interface PlanIndex {
  version: 1;
  lastChecked: string;
  entries: PlanIndexEntry[];
}

const PLANS_DIR = resolve(homedir(), ".claude/plans");

function getProjectKey(): string {
  return process.cwd().replace(/\//g, "_-_");
}

function getIndexPath(): string {
  const projectDir = resolve(homedir(), ".claude/projects", getProjectKey());
  return resolve(projectDir, "plan-index.json");
}

function loadIndex(indexPath: string): PlanIndex {
  if (!existsSync(indexPath)) {
    return { version: 1, lastChecked: "", entries: [] };
  }
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return { version: 1, lastChecked: "", entries: [] };
  }
}

function extractTitle(filePath: string): string {
  try {
    const content = readFileSync(filePath, "utf-8").slice(0, 500);
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";
  } catch {
    return filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";
  }
}

function main() {
  if (!existsSync(PLANS_DIR)) return;

  const indexPath = getIndexPath();
  const index = loadIndex(indexPath);

  const lastCheckedMs = index.lastChecked
    ? new Date(index.lastChecked).getTime()
    : 0;

  const existingSlugs = new Set(index.entries.map((e) => e.slug));

  const files = readdirSync(PLANS_DIR);
  const newEntries: PlanIndexEntry[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const fullPath = join(PLANS_DIR, file);
    const slug = file.replace(/\.md$/, "");

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.mtimeMs <= lastCheckedMs) continue;

    if (existingSlugs.has(slug)) {
      const existing = index.entries.find((e) => e.slug === slug);
      if (existing) {
        existing.fileModified = stat.mtime.toISOString();
        existing.title = extractTitle(fullPath);
      }
      continue;
    }

    newEntries.push({
      filePath: fullPath,
      title: extractTitle(fullPath),
      fileModified: stat.mtime.toISOString(),
      detectedAt: new Date().toISOString(),
      slug,
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
} catch {
  // Silent exit — hook must not produce output or errors
}
