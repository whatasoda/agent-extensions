# Coordination Files Specification

This document defines the file-based coordination protocol shared by soda-team-init and soda-team-run.

All coordination files live under `.agent-team/<YYYYMMDD>-<project-name>/` in the repository root. Each namespaced subdirectory represents an independent project, allowing multiple soda-team-init sessions to coexist in the same repository.

## Directory Structure

```
.agent-team/
└── <YYYYMMDD>-<project-name>/    — Namespaced project directory (e.g., 20260320-auth-refactor)
    ├── CONFIG.md             — Project configuration (integration branch, creation metadata)
    ├── TASKS.md              — Task list and status (managed by Orchestrator)
    ├── ARCHITECTURE.md       — Architecture decision records (managed by Architect)
    ├── tasks/
    │   ├── TASK-001.md       — Individual task instruction (managed by Orchestrator + Architect)
    │   ├── TASK-002.md
    │   └── ...
    └── reviews/
        ├── REVIEW-001-1.md   — Review result for TASK-001, attempt 1 (managed by Reviewer)
        └── ...
```

### Namespace Convention

- **Format**: `<YYYYMMDD>-<project-name>` (e.g., `20260320-auth-refactor`)
- **Date prefix**: Creation date in `YYYYMMDD` format for chronological sorting
- **Project name**: Slugified from the project description (same as the `team/<project-name>` integration branch)
- **Collision handling**: If the directory already exists, append `-2`, `-3`, etc. until unique

## CONFIG.md

Project-level configuration set during soda-team-init. Read by soda-team-run to determine merge targets and project metadata.

```markdown
# Team Config
- **Integration Branch**: {{branch name}}
- **Created From**: {{base branch or commit SHA}}
- **Created At**: {{ISO date}}
```

**Managed by**: soda-team-init (created), soda-team-run (read-only)
**Updated when**: Initial creation only. If the integration branch needs to change, re-run soda-team-init.

## TASKS.md

Task list with group overview and per-task status.

**State legend**: `[ ]` pending, `[~]` in-progress, `[x]` done, `[!]` blocked

```markdown
# Tasks

## Groups
- **GROUP-A**: {{description}} ({{N}} tasks, {{done}} done, {{in-progress}} in-progress, {{pending}} pending)
- **GROUP-B**: {{description}} ({{N}} tasks, {{done}} done, {{in-progress}} in-progress, {{pending}} pending)

## Task List
- [x] TASK-001: {{title}} (group: A, merged: {{commit-sha}})
- [~] TASK-002: {{title}} (group: A, worker: worktree-002)
- [ ] TASK-003: {{title}} (group: A, deps: TASK-001)
- [!] TASK-004: {{title}} (group: B, blocked: "{{reason}}")
```

**Managed by**: Orchestrator
**Updated when**: Task assignment, completion, merge, or block

## TASK-NNN.md

Self-contained instruction for a Worker. The Worker should be able to implement the task by reading only this file.

```markdown
# TASK-NNN: {{title}}

## Definition
- **Group**: {{GROUP-X}}
- **Goal**: {{what to achieve — 1-2 sentences}}
- **Acceptance**: {{pass/fail condition}}
- **Deps**: {{TASK-NNN | "none"}}

## Design Constraints
- ADR-NNN: {{summary of the relevant decision — not just a reference, include enough context for the Worker}}
- {{additional constraints from Architect if any}}

## Context
- `{{path/to/file}}` — {{what about this file is relevant}}
- `{{path/to/file}}` — {{same}}
- {{relevant information transcribed from Investigator findings}}

## Validation
- `{{runnable command}}` — {{expected outcome}}
- {{additional verification methods}}

## History
{{Only present for re-implementation. Contains previous Reviewer findings.}}
- Attempt N: FAIL — "{{specific issue}}" (REVIEW-NNN-N)
```

**Managed by**: Orchestrator (Definition, Context, Validation) + Architect (Design Constraints)
**Created when**: Task assignment
**Updated when**: Re-implementation (History appended from REVIEW-NNN)

### Design Principles

- **Self-contained**: Worker reads only this file. Design Constraints include summarized ADR content, not just references.
- **History for learning**: Re-implementation attempts carry forward Reviewer findings to prevent repeating the same mistakes.
- **Concrete context**: File paths and relevant details from Investigator findings are transcribed here, not left as references to other files.

## ARCHITECTURE.md

Architecture Decision Records maintained by Architect. The primary mechanism for preventing Architectural Drift across Workers.

```markdown
# Architecture Decisions

## ADR-NNN: {{topic}}
- **Decision**: {{what was decided}}
- **Context**: {{why this decision was needed}}
- **Options**:
  - A: {{description}} — {{pros / cons}}
  - B: {{description}} — {{pros / cons}}
- **Rationale**: {{why the chosen option was selected}}
- **Affected Areas**: `{{path/}}`, `{{path/}}`
- **Status**: {{Active | Superseded (by ADR-NNN) | Deprecated}}
- **Source**: {{soda-discuss | Architect decision | User instruction}}
```

**Managed by**: Architect
**Updated when**: New design decision, decision revision, or deprecation

### Quality Safeguards

- **Source field**: Traces the origin of each decision. soda-discuss decisions are transcribed from Living Discussion Document DD-N entries; Architect decisions include the reasoning; User instructions preserve original wording.
- **Status field**: Active / Superseded (with pointer to replacement ADR) / Deprecated. Prevents stale decisions from misleading Workers.
- **Affected Areas specificity**: Must be directory or file-path level. Vague entries like "entire codebase" are prohibited. Reviewer uses these for compliance checking.

### Initial State

On soda-team-init execution, Design Decisions (DD-N) from the preceding soda-discuss Living Discussion Document are transcribed as the initial set of ADRs. Each ADR's Source field references the originating DD-N.

## REVIEW-NNN-A.md

Review result for a completed task. File naming: `REVIEW-{task number}-{attempt number}.md` (e.g., `REVIEW-001-1.md` for TASK-001's first review, `REVIEW-001-2.md` for the second). This preserves both the task correspondence and the full review history across retries.

Written by Reviewer, consumed by Orchestrator (for status updates) and by future Workers (via TASK-NNN.md History).

```markdown
# REVIEW-NNN-A: TASK-NNN (Attempt A)

## Verdict: {{PASS | PASS_WITH_FIX | FAIL | ESCALATE}}

## Summary
{{1-2 sentence overview of the review result}}

## Findings
- **[PASS]** {{criterion met}} — {{evidence}}
- **[FAIL]** {{issue found}} — {{specific details}}
- **[WARN]** {{minor concern}} — {{impact assessment}}

## ADR Compliance
- ADR-NNN: {{OK | VIOLATION — description of what diverges}}

## Trivial Fixes Applied
{{PASS_WITH_FIX or ESCALATE with trivial fixes. Each fix must be 1-2 lines and unambiguous.}}
- `{{path/to/file}}:{{line}}` — {{what was fixed}}

## For Next Worker
{{FAIL only. Concrete instructions for re-implementation.}}
- {{what to fix, with file paths and line references to existing patterns}}

## Escalation
{{ESCALATE only. Problem description for Architect.}}
- {{what assumption or decision needs revisiting and why}}

## Implicit Decisions Detected
{{Present when implicit design decisions are found (criterion 6). Listed regardless of verdict.}}
- **[file:line]** {{decision description}} — not covered by task definition or Design Constraints
```

**Managed by**: Reviewer
**Created when**: Review completion

### Verdict Semantics

- **PASS**: Task meets acceptance criteria and ADR compliance. Orchestrator proceeds to merge.
- **PASS_WITH_FIX**: Task meets criteria after Reviewer applied trivial fixes (1-2 lines, unambiguous). Fixes are committed by Reviewer and recorded. Orchestrator proceeds to merge.
- **FAIL**: Worker-level issue. Orchestrator creates a new Worker with the findings transcribed to TASK-NNN.md History.
- **ESCALATE**: Design-level issue. Orchestrator routes to Architect for decision revision before re-assignment.
