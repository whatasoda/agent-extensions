import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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

function getProjectKey(): string {
  return process.cwd().replace(/\//g, "-");
}

const indexPath = resolve(
  homedir(),
  ".claude/projects",
  getProjectKey(),
  "plan-index.json"
);

if (!existsSync(indexPath)) {
  console.log(
    JSON.stringify({
      plans: [],
      totalCount: 0,
      message:
        "No plan index found. Plans will be indexed automatically as you use Claude Code.",
    })
  );
  process.exit(0);
}

try {
  const index: PlanIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
  const plans = index.entries
    .sort(
      (a, b) =>
        new Date(b.fileModified).getTime() - new Date(a.fileModified).getTime()
    )
    .map(({ slug, title, fileModified, filePath }) => ({
      slug,
      title,
      fileModified,
      filePath,
    }));

  console.log(JSON.stringify({ plans, totalCount: plans.length }));
} catch {
  console.log(
    JSON.stringify({
      plans: [],
      totalCount: 0,
      message: "Failed to read plan index.",
    })
  );
}
