import { $ } from "bun";

export async function handleUpdate(args: string[]): Promise<void> {
  const tag = args[0] || "latest";
  const pkg = `@whatasoda/agent-tools@${tag}`;

  console.log(`Updating ${pkg}...`);
  await $`bun add -g ${pkg}`;
}
