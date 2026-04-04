# soda-discuss — Design Rationale

## Background

soda-discuss was originally a design discussion skill that persisted decisions to Living Discussion Document (LDD) files (`.agent-discussions/*.md`). sb-brainstorm was a separate skill in soda-brain for freeform brainstorming with knowledge graph persistence.

## Integration (2026-03-28)

The two skills were merged based on the following observations:

1. **Overlapping purpose**: Both were interactive dialogue skills with nearly identical Core Values and Interaction Principles
2. **Complementary persistence**: soda-discuss had structured decision recording (DD-N), sb-brainstorm had incremental memo capture + conversation wrap-up
3. **LDD worktree problem**: LDD files were repo-local, breaking in git worktrees

## Key Design Decisions

- **DB-first persistence**: Decisions write directly to soda-brain SQLite DB via `sd decision create`, replacing LDD files entirely
- **Natural flow**: No explicit mode switching between exploration and decision-making — the conversation flows naturally, with only wrap-up being an explicit phase
- **Decision immediate, memos batched**: Design decisions are recorded immediately (Bash permission = approval checkpoint). Memos are captured as text during discussion and batch-written during wrap-up
- **Conversation node as link hub**: The wrap-up conversation node stores session metadata (context, key_points, open_questions) and links to decisions/memos. It does NOT duplicate decision content
- **allowed-tools restriction**: `Bash(sd *)` only — no arbitrary shell access. Investigation via Task sub-agents

## References

- LDD: `.agent-discussions/2026-03-28-decision-persistence-integration.md` (concluded, DD-1 through DD-32)
