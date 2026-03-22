# soda-review

## Background

Originally derived from branch review patterns (~190 occurrences in session history), soda-review was a code quality review skill covering four perspectives (correctness, completeness, quality, potential issues). However, code quality review is adequately covered by `/soda-fix` (automated) and manual instructions, leaving soda-review unused.

Repurposed as a **design conformance review** skill based on a recurring manual workflow: comparing implementation changes against Design Decisions (DD-N) from Living Discussion Documents to identify conformance gaps and implicit design decisions.

## Purpose

Pre-merge design alignment gate. Verifies that implementation satisfies recorded Design Decisions and surfaces unrecorded design judgments introduced during implementation. Part of a two-layer conformance checking architecture:

- **Layer A** (team-reviewer): Per-task implicit decision detection during Worker→Reviewer cycles
- **Layer B** (this skill): Project-wide DD-N conformance review across the full branch diff

## Design Notes

- **Two parallel sub-agents**: DD verification and implicit decision detection run concurrently. DD verification checks each DD-N constraint against the diff. Implicit detection scans the diff for unrecorded design judgments.
- **Report-only constraint**: The review must not modify code. Design conformance issues are bidirectional — sometimes the implementation is wrong, sometimes the DD is outdated. The user decides which side to change.
- **Graceful degradation (DD-7)**: When no Living Discussion Document exists, DD verification is skipped. Implicit decision detection runs in discovery mode, reporting all non-trivial design judgments as formalization candidates.
- **Reuses detect-base-branch.ts**: Same branch context detection as the original soda-review, supporting PR base, nearest base branch detection, and explicit base specification.

## Typical Usage Patterns

```
/soda-review
```

```
/soda-review origin/develop からの差分を対象に
```

## Skill Chain Position

```
soda-research/soda-brief → soda-discuss → soda-plan → [implementation] → soda-review → soda-fix
```

soda-review checks design conformance after implementation. soda-fix handles code quality issues separately.
