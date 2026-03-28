import { spawn } from "node:child_process";

export function launchClaude(exit: () => void, prompt: string): void {
  exit();
  spawn("claude", ["--prompt", prompt], { stdio: "inherit" });
}

export function copyToClipboard(text: string): void {
  const proc = spawn("pbcopy", [], { stdio: ["pipe"] });
  proc.stdin?.end(text);
}
