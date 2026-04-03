import path from "path";
import { exitWithError } from "../helpers.js";

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
  const filePath = path.resolve(baseDir, name, "body.md");
  if (!filePath.startsWith(baseDir + path.sep)) {
    exitWithError(`Invalid skill name: ${name}`);
  }
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    exitWithError(`Skill not found: ${name}`);
  }
  const content = await file.text();
  process.stdout.write(content);
}
