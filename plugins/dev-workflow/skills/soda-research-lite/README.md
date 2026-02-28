# soda-research-lite

## Background

Lightweight variant of `/soda-research`. Created as part of the Full + Lite pairing convention used throughout the dev-workflow plugin. The lite version trades investigation depth (no sub-agents, single annotation round) for token efficiency and speed.

## Purpose

Quick codebase research for topics that don't require deep multi-agent investigation. Produces the same Research Summary format as the full version, enabling seamless handoff to `/soda-plan` or `/soda-propose`.

## Design Notes

- **No sub-agents**: The Task tool is excluded from `allowed-tools`, enforcing direct investigation only. This is the primary difference from the full version and matches the pattern in `soda-propose-lite`.

- **Single AskUserQuestion**: The annotation checkpoint combines correction input and finalization into one interaction. The user can either correct findings and finalize, finalize immediately, or escalate to the full version. This is the only interactive gate in the skill.

- **Same Research Summary format**: The output format is identical to `/soda-research`, ensuring downstream skills (soda-plan, soda-propose) don't need separate detection logic for the lite variant.

- **Escalation path**: When the user realizes deeper investigation is needed, the skill explicitly suggests `/soda-research` rather than attempting to do more with limited tools.

### What was removed from the full version

| Feature | Full | Lite | Reason for removal |
|---------|------|------|--------------------|
| Sub-agent investigation | 2-step (survey + focused) | Direct only | Token efficiency |
| Annotation cycle rounds | Unlimited (2-3 optimal) | Single round | Speed |
| AskUserQuestion count | Multiple (per round) | 1 total | Reduced interaction |
| Investigation depth | Multi-round deepening | Single-pass | Token efficiency |

## Typical Usage Patterns

```
/soda-research-lite このモジュールの依存関係を確認したい
```

```
/soda-research-lite ビルド設定の構造
```

## Future Improvements

- Consider adding a "depth hint" that lets the user request slightly more investigation without escalating to full version
