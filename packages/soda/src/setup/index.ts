import fs from "fs";
import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const SKILL_PREFIX = "sb-";
const SKILLS_SOURCE_DIR = path.resolve(import.meta.dir, "../../../skills");
const BASH_PERMISSION = "Bash(@whatasoda/agent-tools:*)";

// 1. Install skill files
const skillFiles = fs.readdirSync(SKILLS_SOURCE_DIR).filter((f) => f.endsWith(".md"));

for (const file of skillFiles) {
  const skillName = file.replace(/\.md$/, "");
  const destDir = path.join(SKILLS_DIR, `${SKILL_PREFIX}${skillName}`);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(path.join(SKILLS_SOURCE_DIR, file), path.join(destDir, "SKILL.md"));
  console.log(`Installed skill: ${SKILL_PREFIX}${skillName}`);
}

// 2. Update settings.json: add Bash permission, remove stale MCP config
let settings: Record<string, unknown> = {};
if (fs.existsSync(SETTINGS_PATH)) {
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    console.error(`Error: Failed to parse ${SETTINGS_PATH}. Settings not updated.`);
    process.exit(1);
  }
}

// Add Bash(@whatasoda/agent-tools:*) permission if absent
const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
const allow = (permissions.allow ?? []) as string[];
if (allow.includes(BASH_PERMISSION)) {
  console.log(`Permission already present: ${BASH_PERMISSION}`);
} else {
  allow.push(BASH_PERMISSION);
  console.log(`Added permission: ${BASH_PERMISSION}`);
}
permissions.allow = allow;
settings.permissions = permissions;

// Remove stale mcpServers.soda-brain if present
const mcpServers = settings.mcpServers as Record<string, unknown> | undefined;
if (mcpServers && "soda-brain" in mcpServers) {
  delete mcpServers["soda-brain"];
  console.log("Removed stale mcpServers.soda-brain config");
  if (Object.keys(mcpServers).length === 0) {
    delete settings.mcpServers;
  }
}

fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`Updated settings in ${SETTINGS_PATH}`);

console.log("\nSetup complete.");
