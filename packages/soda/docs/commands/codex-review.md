### sd codex-review

#### sd codex-review <mode> [args...]
Runs codex review with the specified mode. Stdin is inherited for passing content.

Delegates to `scripts/codex-review.ts`.

Modes and arguments are passed through to the underlying script.

Example:
```sh
sd codex-review findings --instruction "Review for correctness"
```
