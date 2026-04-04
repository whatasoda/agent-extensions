import path from "path";
import { exitWithError } from "../helpers.js";
import { createSkillContext } from "../../core/skill-context.js";

const packageRoot = path.resolve(import.meta.dir, "../../../");

export async function handleAgent(args: string[]): Promise<void> {
  const [action, name] = args;

  switch (action) {
    case "print":
      return agentPrint(name);
    default:
      exitWithError("Usage: soda agent <print> <name>");
  }
}

async function agentPrint(name: string | undefined): Promise<void> {
  if (!name) {
    exitWithError("Usage: soda agent print <name>");
  }
  const baseDir = path.join(packageRoot, "agents");
  const filePath = path.resolve(baseDir, name, "body.ts");
  if (!filePath.startsWith(baseDir + path.sep)) {
    exitWithError(`Invalid agent name: ${name}`);
  }
  if (!(await Bun.file(filePath).exists())) {
    exitWithError(`Agent not found: ${name}`);
  }
  const mod = await import(filePath);
  const ctx = createSkillContext(packageRoot);
  process.stdout.write(mod.default(ctx));
}
