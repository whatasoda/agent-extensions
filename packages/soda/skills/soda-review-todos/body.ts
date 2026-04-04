export default function (ctx: { commandDocs(commands: string[]): string }): string {
  return `
${ctx.commandDocs(["node", "list"])}

## Instructions
1. Fetch all TODOs: \`sd node search --kind todo\`
2. If tags provided, filter: \`sd node search --kind todo --tags <tag1>,<tag2>\`
3. Present TODOs grouped by status (pending → in_progress → done)
4. For each pending TODO, discuss with user:
   - Priority assessment (suggest based on deadlines, dependencies)
   - Status update if needed → \`sd node update <id> --prop status=in_progress --prop priority=high\`
5. Identify blocked or stale TODOs
6. Summarize changes made
`;
}
