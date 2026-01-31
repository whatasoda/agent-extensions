/**
 * Simple PostToolUse hook that logs tool usage.
 */
const hookEvent = JSON.parse(process.argv[2] || "{}");

const toolName = hookEvent?.tool_name ?? "unknown";
const timestamp = new Date().toISOString();

console.log(`[hello-plugin] Tool used: ${toolName} at ${timestamp}`);
