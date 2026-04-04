import { readFileSync } from "fs";
import path from "path";

export interface SkillContext {
  commandDocs(commands: string[]): string;
}

export type SkillBodyFn = (ctx: SkillContext) => string;

export function createSkillContext(packageRoot: string): SkillContext {
  const docsDir = path.join(packageRoot, "docs", "commands");
  return {
    commandDocs(commands: string[]): string {
      const sections = commands.map((cmd) => {
        const filePath = path.join(docsDir, `${cmd}.md`);
        return readFileSync(filePath, "utf-8").trim();
      });
      return `## sd CLI Reference\n\n${sections.join("\n\n")}`;
    },
  };
}
