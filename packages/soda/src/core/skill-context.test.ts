import { describe, expect, it } from "bun:test";
import { readdirSync } from "fs";
import path from "path";
import { createSkillContext } from "./skill-context";
import type { SkillBodyFn } from "./skill-context";

const packageRoot = path.resolve(import.meta.dir, "../../");
const ctx = createSkillContext(packageRoot);

const skillsDir = path.join(packageRoot, "skills");
const agentsDir = path.join(packageRoot, "agents");

const skillNames = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const agentNames = readdirSync(agentsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

function validateMarkdown(output: string, name: string) {
  // Non-empty output
  expect(output.trim().length).toBeGreaterThan(0);

  // No unresolved template literals (escaped ${} that leaked through)
  const unresolvedInterpolations = output.match(/\$\{[^}]*\}/g) || [];
  const filtered = unresolvedInterpolations.filter(
    // ctx.commandDocs calls are resolved at runtime, so none should remain
    // Allow ${ only inside code fences where it's intentional shell/JS syntax
    (match) => {
      const idx = output.indexOf(match);
      return !isInsideCodeFence(output, idx);
    },
  );
  expect(filtered).toEqual([]);

  // Code fences are balanced (``` open/close pairs)
  const fenceMatches = output.match(/^```/gm) || [];
  expect(fenceMatches.length % 2).toBe(0);

  // No stale "wat" CLI label
  const watTableHeader = /Available CLI Commands \(wat\)/i;
  expect(output).not.toMatch(watTableHeader);
}

function isInsideCodeFence(text: string, position: number): boolean {
  const before = text.slice(0, position);
  const fences = before.match(/^```/gm) || [];
  // Odd number of fences means we're inside a code block
  return fences.length % 2 === 1;
}

describe("skill body.ts markdown output", () => {
  it.each(skillNames)("skill/%s produces valid markdown", async (name) => {
    const bodyPath = path.join(skillsDir, name, "body.ts");
    const mod = await import(bodyPath);
    const bodyFn: SkillBodyFn = mod.default;
    const output = bodyFn(ctx);
    validateMarkdown(output, `skill/${name}`);
  });
});

describe("agent body.ts markdown output", () => {
  it.each(agentNames)("agent/%s produces valid markdown", async (name) => {
    const bodyPath = path.join(agentsDir, name, "body.ts");
    const mod = await import(bodyPath);
    const bodyFn: SkillBodyFn = mod.default;
    const output = bodyFn(ctx);
    validateMarkdown(output, `agent/${name}`);
  });
});

describe("commandDocs embedding", () => {
  const skillsWithDocs: Record<string, string[]> = {
    "soda-discuss": ["node", "tag", "link", "list", "decision"],
    "soda-fix": ["review"],
    "soda-plan": ["decision", "session", "review"],
    "soda-review": ["review", "decision"],
    "soda-review-todos": ["node", "list"],
    "soda-team-init": ["decision"],
    "soda-todo": ["node", "tag"],
  };

  const agentsWithDocs: Record<string, string[]> = {
    "codex-review": ["codex-review", "session"],
  };

  for (const [name, commands] of Object.entries(skillsWithDocs)) {
    it(`skill/${name} embeds sd CLI Reference`, async () => {
      const mod = await import(path.join(skillsDir, name, "body.ts"));
      const output: string = mod.default(ctx);
      expect(output).toContain("## sd CLI Reference");
      for (const cmd of commands) {
        expect(output).toContain(`### sd ${cmd}`);
      }
    });
  }

  for (const [name, commands] of Object.entries(agentsWithDocs)) {
    it(`agent/${name} embeds sd CLI Reference`, async () => {
      const mod = await import(path.join(agentsDir, name, "body.ts"));
      const output: string = mod.default(ctx);
      expect(output).toContain("## sd CLI Reference");
      for (const cmd of commands) {
        expect(output).toContain(`### sd ${cmd}`);
      }
    });
  }

  const skillsWithoutDocs = ["soda-brief", "soda-research", "soda-team-run"];

  const agentsWithoutDocs = ["team-reviewer", "team-worker"];

  for (const name of skillsWithoutDocs) {
    it(`skill/${name} does NOT embed sd CLI Reference`, async () => {
      const mod = await import(path.join(skillsDir, name, "body.ts"));
      const output: string = mod.default(ctx);
      expect(output).not.toContain("## sd CLI Reference");
    });
  }

  for (const name of agentsWithoutDocs) {
    it(`agent/${name} does NOT embed sd CLI Reference`, async () => {
      const mod = await import(path.join(agentsDir, name, "body.ts"));
      const output: string = mod.default(ctx);
      expect(output).not.toContain("## sd CLI Reference");
    });
  }
});
