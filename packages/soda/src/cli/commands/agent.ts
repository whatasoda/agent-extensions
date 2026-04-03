import path from "path";
import { exitWithError } from "../helpers.js";

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
  const filePath = path.resolve(baseDir, name, "body.md");
  if (!filePath.startsWith(baseDir + path.sep)) {
    exitWithError(`Invalid agent name: ${name}`);
  }
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    exitWithError(`Agent not found: ${name}`);
  }
  const content = await file.text();
  process.stdout.write(content);
}
