import { parseArgs } from "node:util";
import path from "path";

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data));
}

export function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
}

export async function readStdin(): Promise<unknown> {
  const text = await Bun.stdin.text();
  const trimmed = text.trim();
  if (!trimmed) {
    exitWithError("Error: --stdin specified but no input received");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    exitWithError("Error: invalid JSON on stdin");
  }
}

export function parseProps(
  propArgs: string[] | undefined,
  propsJson: string | undefined,
): Record<string, unknown> | undefined {
  if (!propArgs?.length && !propsJson) {
    return undefined;
  }

  let base: Record<string, unknown> = {};

  if (propsJson) {
    try {
      base = JSON.parse(propsJson);
    } catch {
      exitWithError("Error: invalid JSON in --props-json");
    }
  }

  if (propArgs?.length) {
    for (const prop of propArgs) {
      const eq = prop.indexOf("=");
      if (eq === -1) {
        exitWithError(`Error: invalid --prop format "${prop}", expected key=value`);
      }
      base[prop.slice(0, eq)] = prop.slice(eq + 1);
    }
  }

  return base;
}

/**
 * Resolve a script path under packageRoot/scripts/, using .ts in dev and .js in built dist.
 */
export function resolveScript(packageRoot: string, name: string): string {
  const ext = import.meta.file.endsWith(".ts") ? ".ts" : ".js";
  return path.join(packageRoot, "scripts", `${name}${ext}`);
}

export function parseCli(
  args: string[],
  options: Record<
    string,
    { type: "string" | "boolean"; multiple?: boolean; default?: string | boolean | string[] }
  >,
): { values: Record<string, unknown>; positionals: string[] } {
  return parseArgs({
    allowPositionals: true,
    args,
    options,
    strict: false,
  }) as { values: Record<string, unknown>; positionals: string[] };
}
