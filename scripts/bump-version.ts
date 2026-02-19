import { resolve } from "node:path";
import { parseArgs } from "node:util";

const rootDir = resolve(import.meta.dirname, "..");

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const pluginName = positionals[0];
if (!pluginName) {
  console.error(
    "Usage: bun run scripts/bump-version.ts <plugin-name> [--dry-run]"
  );
  process.exit(1);
}

const pluginJsonPath = resolve(
  rootDir,
  "plugins",
  pluginName,
  ".claude-plugin",
  "plugin.json"
);
const marketplacePath = resolve(rootDir, ".claude-plugin", "marketplace.json");

const pluginJsonFile = Bun.file(pluginJsonPath);
if (!(await pluginJsonFile.exists())) {
  console.error(`Plugin "${pluginName}" not found at ${pluginJsonPath}`);
  process.exit(1);
}

const pluginJson = await pluginJsonFile.json();
const oldVersion: string = pluginJson.version;

const parts = oldVersion.split(".").map(Number);
parts[2] += 1;
const newVersion = parts.join(".");

pluginJson.version = newVersion;

const marketplace = await Bun.file(marketplacePath).json();
const entry = marketplace.plugins.find(
  (p: { name: string }) => p.name === pluginName
);
if (!entry) {
  console.error(`Plugin "${pluginName}" not found in marketplace.json`);
  process.exit(1);
}
entry.version = newVersion;

if (!values["dry-run"]) {
  await Bun.write(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n");
  await Bun.write(
    marketplacePath,
    JSON.stringify(marketplace, null, 2) + "\n"
  );
}

console.log(
  JSON.stringify({
    plugin: pluginName,
    oldVersion,
    newVersion,
    dryRun: values["dry-run"],
  })
);
