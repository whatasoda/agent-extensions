import path from "path";
import { exitWithError } from "../helpers.js";
import { createSkillContext } from "../../core/skill-context.js";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleSkill(args: string[]): Promise<void> {
  const [action, name] = args;

  switch (action) {
    case "print":
      return skillPrint(name);
    default:
      exitWithError("Usage: soda skill <print> <name>");
  }
}

async function skillPrint(name: string | undefined): Promise<void> {
  if (!name) {
    exitWithError("Usage: soda skill print <name>");
  }
  const baseDir = path.join(packageRoot, "skills");
  const filePath = path.resolve(baseDir, name, "body.ts");
  if (!filePath.startsWith(baseDir + path.sep)) {
    exitWithError(`Invalid skill name: ${name}`);
  }
  if (!(await Bun.file(filePath).exists())) {
    exitWithError(`Skill not found: ${name}`);
  }
  const mod = await import(filePath);
  const ctx = createSkillContext(packageRoot);
  process.stdout.write(mod.default(ctx));
}
