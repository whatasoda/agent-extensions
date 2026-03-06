# soda-fix

## Background

A common workflow pattern in development sessions involves sending branch changes to the codex-review agent, identifying critical and high-severity issues, and applying fixes. This cycle is repeated manually, with the user acting as the orchestrator between review findings and code modifications. Formalizing this workflow reduces repetitive manual effort and ensures consistent handling of review findings.

## Purpose

Automate the "codex-review → classify → fix/confirm" workflow with appropriate user decision gates. soda-fix bridges the gap between soda-review (report-only) and soda-plan (full implementation planning) by handling targeted, issue-driven fixes directly.

## Design Notes

- **Why findings-only mode**: codex-review's default behavior (init mode) performs internal auto-revision (Steps 4/5) when critical issues are found, returning revised content. soda-fix needs raw, unrevised findings to classify each issue individually and apply per-issue decision gates. The `findings` mode was added to codex-review to return raw findings without auto-revision.

- **Why per-issue AskUserQuestion**: The user explicitly requires granular control over ambiguous fixes — cases where multiple fix strategies exist or where the necessity of a fix is debatable. Batch confirmation would lose the context needed for informed decisions. A summary gate (Phase 4) prevents excessive interruptions by allowing the user to abort, batch-skip, or reclassify before individual confirmations begin.

- **Why severity-based classification**: Issues are classified into Auto-fix (clear, single-strategy Critical/High), User-confirm (ambiguous Critical/High), and Skip (Medium/Low). This enables automatic handling of obvious blockers while gating debatable issues. The conservative fallback rule (unparseable output → all User-confirm) prevents silent incorrect auto-fixes.

- **Positioning in the soda workflow family**:
  - `/soda-review` / `/soda-review-lite` — Report findings only, no modifications
  - `/soda-fix` — Targeted fixes driven by review findings, with user decision gates
  - `/soda-plan` — Full implementation planning for larger changes or refactors

- **Re-review strategy**: After applying fixes, the user can optionally trigger a fresh codex-review session (not resume mode) to verify fixes and catch regressions. Fresh sessions avoid reviewer drift that can occur with resume mode.

## Typical Usage

```
# After making changes on a feature branch
/soda-fix
```

The skill will:
1. Collect the branch diff
2. Send it to codex-review for analysis
3. Classify issues by severity
4. Present a summary with action options
5. Apply clear fixes automatically, ask about ambiguous ones
6. Report results and offer re-review
