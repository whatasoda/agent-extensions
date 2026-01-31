import { resolve } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";

interface RawEntry {
  display: string;
  project: string;
  timestamp: number;
  pastedContents: Record<string, { id: number; type: string; content: string }>;
}

interface OutputEntry {
  timestamp: string;
  project: string;
  prompt: string;
  has_pasted_content: boolean;
}

const SLASH_COMMAND_ONLY = /^\s*\/\w+\s*$/;
const PASTED_TEXT_PATTERN = /\[Pasted text #(\d+)[^\]]*\]/g;
const HOME = homedir();

function shortenPath(p: string): string {
  return p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p;
}

function expandPastedContents(
  display: string,
  pasted: RawEntry["pastedContents"]
): string {
  if (!pasted || Object.keys(pasted).length === 0) return display;
  return display.replace(PASTED_TEXT_PATTERN, (_, id) => {
    const entry = pasted[id];
    return entry?.content ?? _;
  });
}

function parseCliArgs() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      top: { type: "string", default: "30" },
      since: { type: "string" },
      project: { type: "string" },
      "summary-only": { type: "boolean", default: false },
    },
  });
  return {
    top: parseInt(values.top!, 10),
    since: values.since ? new Date(values.since).getTime() : undefined,
    project: values.project,
    summaryOnly: values["summary-only"]!,
  };
}

async function main() {
  const args = parseCliArgs();
  const historyPath = resolve(HOME, ".claude", "history.jsonl");
  const file = Bun.file(historyPath);
  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());

  const entries: RawEntry[] = lines.map((l) => JSON.parse(l));
  const totalRaw = entries.length;

  // Determine top N projects by latest activity
  const projectLatest = new Map<string, number>();
  for (const e of entries) {
    const cur = projectLatest.get(e.project) ?? 0;
    if (e.timestamp > cur) projectLatest.set(e.project, e.timestamp);
  }
  const topProjects = new Set(
    [...projectLatest.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, args.top)
      .map(([p]) => p)
  );

  // Filter
  const filtered = entries.filter((e) => {
    if (!topProjects.has(e.project)) return false;
    if (args.since && e.timestamp < args.since) return false;
    if (args.project && !e.project.includes(args.project)) return false;
    if (!e.display || e.display.trim().length < 5) return false;
    if (SLASH_COMMAND_ONLY.test(e.display)) return false;
    return true;
  });

  // Normalize and output
  const output: OutputEntry[] = filtered.map((e) => ({
    timestamp: new Date(e.timestamp).toISOString(),
    project: shortenPath(e.project),
    prompt: expandPastedContents(e.display, e.pastedContents),
    has_pasted_content:
      !!e.pastedContents && Object.keys(e.pastedContents).length > 0,
  }));

  // Summary to stderr
  const projectCounts = new Map<string, number>();
  for (const o of output) {
    projectCounts.set(o.project, (projectCounts.get(o.project) ?? 0) + 1);
  }

  const keywords = [
    "commit",
    "コミット",
    "test",
    "テスト",
    "review",
    "レビュー",
    "refactor",
    "リファクタ",
    "fix",
    "修正",
    "build",
    "ビルド",
    "deploy",
    "デプロイ",
    "実装",
    "設計",
    "調査",
    "確認",
    "追加",
    "削除",
    "変更",
    "移動",
    "整理",
    "説明",
    "PR",
    "マージ",
    "revert",
    "debug",
    "エラー",
    "型",
  ];
  const keywordCounts = new Map<string, number>();
  for (const o of output) {
    const lower = o.prompt.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        keywordCounts.set(kw, (keywordCounts.get(kw) ?? 0) + 1);
      }
    }
  }

  const summary = {
    total_raw: totalRaw,
    total_filtered: output.length,
    top_projects: args.top,
    projects: [...projectCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => ({ project: p, count: c })),
    keyword_frequency: [...keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([kw, c]) => ({ keyword: kw, count: c })),
  };

  console.error(JSON.stringify(summary, null, 2));

  // JSONL to stdout
  if (!args.summaryOnly) {
    for (const o of output) {
      console.log(JSON.stringify(o));
    }
  }
}

main();
