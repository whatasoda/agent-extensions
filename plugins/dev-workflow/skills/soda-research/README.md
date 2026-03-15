# soda-research

## Background

Inspired by Boris Tane's 4-phase development workflow (Research → Plan → Annotate → Implement). The existing dev-workflow skills cover Plan (soda-plan) well, but research/investigation was always embedded as a sub-step within these skills — never available as a standalone, artifact-producing phase.

Key insight: Separating research from planning allows the user to build understanding before deciding whether to propose approaches or jump straight to planning. The research artifact is reusable across multiple downstream skills.

## Purpose

Provides a standalone codebase research phase that produces structured artifacts (Research Summary) for handoff to other skills. The iterative annotation cycle enables domain knowledge injection — the user corrects and enriches findings before they flow into planning or proposal.

The typical flows:
- `/soda-research` → Research Summary → `/soda-discuss` → `/soda-plan`
- `/soda-research` → Research Summary → `/soda-plan` (skip discuss when approach is obvious)
- `/soda-research` standalone (pure investigation, no follow-up needed)

## Design Notes

- **Annotation cycle as core feature**: The iterative refinement loop (Step 4) is the primary differentiator from the investigation embedded in soda-plan. Boris Tane's workflow emphasizes 1-6 rounds of annotation before moving to the next phase. The skill supports unlimited rounds with "2-3 rounds optimal" as soft guidance. Each round can deepen existing areas, correct misunderstandings, or pivot to new angles.

- **Sub-agent investigation strategy**: Uses the same two-step pattern as soda-plan and soda-discuss: survey agent → focused agents. All sub-agent prompts include the standard constraint block and output contract. This consistency reduces maintenance burden and ensures predictable agent behavior across all skills.

- **Research Summary as structured handoff**: The Research Summary block provides a structured artifact that downstream skills (soda-discuss, soda-plan) use naturally from the conversation context. The format includes Domain Knowledge as a distinct section to preserve user-provided corrections through the handoff.

- **Read-only constraint**: This skill does not modify code. It exists purely in the investigation phase. The `Write` tool is intentionally excluded from `allowed-tools`.

- **Domain Knowledge as authoritative**: User corrections provided during the annotation cycle are treated as ground truth. When downstream skills (soda-discuss, soda-plan) consume the Research Summary, Domain Knowledge entries override any conflicting investigation findings. This ensures the user's expertise is preserved through the entire workflow chain.

- **Theme-based presentation**: Findings are organized by theme (architecture, patterns, dependencies) rather than by agent. This prevents the common pattern where multi-agent output reads as disconnected reports rather than a coherent understanding.

## Typical Usage Patterns

```
/soda-research 認証フローの全体像を把握したい
```

```
/soda-research このリポジトリのビルドパイプラインはどうなっている？
```

Chained flow:
```
/soda-research GraphQL スキーマの構造と依存関係
→ (AI investigates, presents findings)
→ User: "この理解に補足・修正を加える" → "実際にはスキーマは自動生成されている"
→ (AI revises findings with domain knowledge)
→ User: "十分理解できた"
→ (AI emits Research Summary)
→ /soda-discuss 複数スキーマ対応のアプローチ
→ (soda-discuss uses Research Summary as conversation context)
```

## Future Improvements

- Consider adding a file output option (`research.md`) for cross-session persistence (currently relies on in-conversation structured block)
- Consider integration with soda-plans for indexing research artifacts alongside plans
- Explore automatic annotation point suggestions (areas where the AI's confidence is low)
