import path from "path";
import { Glob } from "bun";
import { exitWithError, outputJson } from "../helpers.js";

interface ParsedDD {
  name: string;
  constraint: string;
  why: string;
  scope: string;
  rejectedAlternatives: Array<{ what: string; why_rejected: string }>;
}

interface ParsedLDD {
  topic: string;
  status: string;
  date: string;
  decisions: ParsedDD[];
  filePath: string;
}

function parseFrontmatter(content: string): { topic: string; status: string; date: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { topic: "", status: "", date: "" };
  const fm = match[1];
  const topic = fm.match(/^topic:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const status = fm.match(/^status:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const date = fm.match(/^date:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return { topic, status, date };
}

function parseLDD(content: string, filePath: string): ParsedLDD {
  const fm = parseFrontmatter(content);
  const decisions: ParsedDD[] = [];

  // Split into topic sections
  const topicSections = content.split(/^## Topic \d+:/m).slice(1);

  for (const section of topicSections) {
    const sectionDDs: ParsedDD[] = [];
    const sectionRAs: Array<{ what: string; why_rejected: string }> = [];

    // Extract DDs
    const ddBlocks = section.split(/^#### DD-\d+:\s*/m).slice(1);
    for (const block of ddBlocks) {
      const name = block.split("\n")[0].trim();
      const constraint =
        block.match(/\*\*Constraint\*\*:\s*([\s\S]*?)(?=\n- \*\*)/)?.[1]?.trim() ?? "";
      const why = block.match(/\*\*Why\*\*:\s*([\s\S]*?)(?=\n- \*\*|\n\n|$)/)?.[1]?.trim() ?? "";
      const scope = block.match(/\*\*Scope\*\*:\s*([\s\S]*?)(?=\n\n|$)/)?.[1]?.trim() ?? "";
      if (constraint || name) {
        sectionDDs.push({ name, constraint, why, scope, rejectedAlternatives: [] });
      }
    }

    // Extract RAs
    const raBlocks = section.split(/^#### RA-\d+:\s*/m).slice(1);
    for (const block of raBlocks) {
      const what =
        block.match(/\*\*What\*\*:\s*([\s\S]*?)(?=\n- \*\*)/)?.[1]?.trim() ??
        block.split("\n")[0].trim();
      const whyRejected =
        block.match(/\*\*Why rejected\*\*:\s*([\s\S]*?)(?=\n\n|$)/)?.[1]?.trim() ?? "";
      if (what) {
        sectionRAs.push({ what, why_rejected: whyRejected });
      }
    }

    // Attach RAs to last DD in this topic section (per DD-6)
    if (sectionRAs.length > 0 && sectionDDs.length > 0) {
      sectionDDs[sectionDDs.length - 1].rejectedAlternatives = sectionRAs;
    }

    decisions.push(...sectionDDs);
  }

  return { ...fm, decisions, filePath };
}

async function detectRepo(): Promise<{ owner: string; name: string } | null> {
  try {
    const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const url = (await new Response(proc.stdout).text()).trim();
    await proc.exited;
    if (proc.exitCode !== 0) return null;

    // Parse git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const sshMatch = url.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (sshMatch) return { owner: sshMatch[1], name: sshMatch[2] };
    return null;
  } catch {
    return null;
  }
}

async function scanForLDDs(): Promise<string[]> {
  const repoRoot = await getRepoRoot();
  if (!repoRoot) {
    return exitWithError("Not in a git repository");
  }

  const patterns = [
    ".agent-discussions/*.md",
    ".worktrees/*/.agent-discussions/*.md",
    ".claude/worktrees/*/.agent-discussions/*.md",
  ];

  const found: Map<string, string> = new Map(); // filename -> full path (dedup by filename)

  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: repoRoot, absolute: true, dot: true })) {
      const basename = path.basename(file);
      if (!found.has(basename)) {
        found.set(basename, file);
      }
    }
  }

  return [...found.values()].sort();
}

async function getRepoRoot(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const root = (await new Response(proc.stdout).text()).trim();
    await proc.exited;
    return root || null;
  } catch {
    return null;
  }
}

export async function handleImport(
  db: import("../../core/database.js").Database,
  args: string[],
): Promise<void> {
  const scanMode = args.includes("--scan");
  const dryRun = args.includes("--dry-run");
  const fileArgs = args.filter((a) => !a.startsWith("--"));

  let files: string[];
  if (scanMode) {
    files = await scanForLDDs();
    if (files.length === 0) {
      console.log("No .agent-discussions files found.");
      return;
    }
    console.log(`Found ${files.length} LDD file(s):`);
    for (const f of files) console.log(`  ${f}`);
    console.log("");
  } else if (fileArgs.length > 0) {
    files = fileArgs.map((f) => path.resolve(f));
  } else {
    return exitWithError(
      "Usage: sd decision import --scan  OR  sd decision import <file...>\n  --dry-run  Preview without writing to DB",
    );
  }

  const repo = await detectRepo();
  const topicTag = (filePath: string) => {
    const slug = path.basename(filePath, ".md").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    return `topic:${slug}`;
  };

  let totalImported = 0;
  const results: Array<{ file: string; imported: number; decisions: string[] }> = [];

  for (const file of files) {
    const content = await Bun.file(file).text();
    const ldd = parseLDD(content, file);

    if (ldd.decisions.length === 0) {
      results.push({ file, imported: 0, decisions: [] });
      continue;
    }

    const tag = topicTag(file);
    const importedNames: string[] = [];

    for (const dd of ldd.decisions) {
      if (dryRun) {
        console.log(`[dry-run] Would create: "${dd.name}" (${tag})`);
        if (dd.rejectedAlternatives.length > 0) {
          console.log(`  with ${dd.rejectedAlternatives.length} rejected alternative(s)`);
        }
        importedNames.push(dd.name);
        continue;
      }

      const properties: Record<string, unknown> = {
        constraint: dd.constraint || dd.name,
        why: dd.why,
        scope: dd.scope,
        rejected_alternatives: dd.rejectedAlternatives,
      };
      if (repo) {
        properties.repo_owner = repo.owner;
        properties.repo_name = repo.name;
      }

      db.createNode({
        kind: "decision",
        body: dd.name,
        properties,
        tags: [tag],
      });
      importedNames.push(dd.name);
      totalImported++;
    }

    results.push({ file, imported: importedNames.length, decisions: importedNames });
  }

  if (dryRun) {
    console.log(
      `\n[dry-run] Would import ${results.reduce((s, r) => s + r.imported, 0)} decision(s) total`,
    );
  } else {
    outputJson({ imported: totalImported, files: results });
  }
}
