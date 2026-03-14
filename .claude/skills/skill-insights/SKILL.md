---
name: skill-insights
description: セッション履歴を横断分析し、dev-workflowスキルの改善提案・新規スキル提案を行う
user-invocable: true
context: fork
argument-hint: "[日数] (デフォルト: 7)"
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Agent
---

# Skill Insights — dev-workflow スキル改善分析

全プロジェクトの直近N日間のセッションログを**4つの並列SubAgent**で横断分析し、dev-workflowスキルの利用状況評価・ワークフローパターン検出・新規スキル提案を行う。

**引数**: `/skill-insights 7` のように日数を指定可能（デフォルト: 7日）

## Phase 1: データ抽出

まず、スクリプトの場所を解決する。

```bash
SCRIPT_ROOT="$(git rev-parse --show-toplevel)/.claude/scripts/skill-insights"
echo "SCRIPT_ROOT=$SCRIPT_ROOT"
```

次に、以下の2つのスクリプトを**順番に**実行し、分析データを /tmp に保存する。

```bash
DAYS="${ARGUMENTS:-7}"
bun "$SCRIPT_ROOT/analyze.ts" --days "$DAYS" --output /tmp/skill-insights-raw.json
```

analyze.tsは以下のファイルを生成する:
- `/tmp/skill-insights-raw.json` — フルデータ（metrics.ts用）
- `/tmp/skill-insights-raw-index.json` — インデックスファイル（SubAgent用）
- `/tmp/skill-insights-raw-sessions-{N}.json` — セッションバッチファイル群（SubAgent用、各~1,500行以下）

**コマンド出力のJSONから `batches` フィールドを読み取り、バッチファイルパス一覧を `BATCH_FILES` として保持する。** Phase 2の全Agentプロンプトにこのパスを埋め込む。

```bash
bun "$SCRIPT_ROOT/metrics.ts" --input /tmp/skill-insights-raw.json --output /tmp/skill-insights-metrics.json
```

エラーが出た場合はユーザーに報告して終了。
成功したら、Phase 2へ進む。

## Phase 2: 並列分析（2段階実行）

### 絶対遵守ルール

1. **SubAgentは `Agent` ツールで起動する。**
2. **`subagent_type` パラメータに必ず下記の指定値をそのまま使うこと。** 各SubAgentは `agents/` ディレクトリに分析手順（何をどう分析するか）を全て内包している。省略すると汎用エージェントが起動され、カスタム分析手順が無視される。
3. **`prompt` に分析手順を書き込まないこと。** 分析手順は各SubAgentが内包しているので、promptには「分析対象ファイルパス」「分析期間」「出力先ファイルパス」だけを書く。
4. **Phase 2a の3つは必ず1つのメッセージ内で同時に `Agent` を呼び出すこと。** 1つずつ順番に起動してはならない。
5. **`run_in_background` は使わないこと。** フォアグラウンドで起動し、全SubAgentの結果が返るまで待機する。

### Phase 2a: 基盤分析（3つを1メッセージで同時起動）

**以下3つの `Agent` ツール呼び出しを、必ず1つのメッセージ内で全て同時に行うこと。**

**Agent 1: session-analyst**
```
Agent({
  name: "session-analyst",
  subagent_type: "si-session-analyst",
  description: "セッション内容分析",
  prompt: "分析対象ファイル:\n- /tmp/skill-insights-raw-index.json（インデックス — セッション一覧・メタ情報）\n- セッションバッチファイル（フルturnsデータ）:\n{BATCH_FILESの各パスを1行ずつ「  - {path}」形式で列挙}\n- /tmp/skill-insights-metrics.json（定量メトリクス）\n\n分析期間: 直近 {DAYS} 日間\n\n【重要】全バッチファイルをReadで読み込んでから分析を開始すること。\n\n結果はMarkdownで /tmp/skill-insights-session-analysis.md に書き出すこと。"
})
```

**Agent 2: pattern-analyst**
```
Agent({
  name: "pattern-analyst",
  subagent_type: "si-pattern-analyst",
  description: "パターン検出",
  prompt: "分析対象ファイル:\n- /tmp/skill-insights-raw-index.json（インデックス — セッション一覧・メタ情報）\n- セッションバッチファイル（フルturnsデータ）:\n{BATCH_FILESの各パスを1行ずつ「  - {path}」形式で列挙}\n- /tmp/skill-insights-metrics.json（定量メトリクス）\n\n分析期間: 直近 {DAYS} 日間\n\n【重要】全バッチファイルをReadで読み込んでから分析を開始すること。\n\n結果はMarkdownで /tmp/skill-insights-pattern-analysis.md に書き出すこと。"
})
```

**Agent 3: domain-analyst**
```
Agent({
  name: "domain-analyst",
  subagent_type: "si-domain-analyst",
  description: "業務ドメイン分析",
  prompt: "分析対象ファイル:\n- /tmp/skill-insights-raw-index.json（インデックス — セッション一覧・メタ情報）\n- セッションバッチファイル（フルturnsデータ）:\n{BATCH_FILESの各パスを1行ずつ「  - {path}」形式で列挙}\n- /tmp/skill-insights-metrics.json（定量メトリクス）\n\n分析期間: 直近 {DAYS} 日間\n\n【重要】全バッチファイルをReadで読み込んでから分析を開始すること。\n\n結果はMarkdownで /tmp/skill-insights-domain-analysis.md に書き出すこと。"
})
```

エラーが出た場合はユーザーに報告して終了。
3つのSubAgent**全て**の結果が返ってきたら、Phase 2bへ進む。

### Phase 2b: スキル分析（Phase 2a完了後に起動）

**Phase 2aの3つが全て完了してから、以下のAgentを起動する。Phase 2aと同時に起動してはならない。**
skill-analystはPhase 2aの分析結果MDファイルを読むため、Phase 2a完了後でないと正しく動作しない。

**Agent 4: skill-analyst**
```
Agent({
  name: "skill-analyst",
  subagent_type: "si-skill-analyst",
  description: "スキル分析・提案",
  prompt: "分析対象ファイル:\n- /tmp/skill-insights-raw-index.json（インデックス — セッション一覧・メタ情報・existing_skills/commands/agents）\n- セッションバッチファイル（フルturnsデータ）:\n{BATCH_FILESの各パスを1行ずつ「  - {path}」形式で列挙}\n- /tmp/skill-insights-metrics.json（定量メトリクス）\n- /tmp/skill-insights-domain-analysis.md（業務ドメイン分析結果 — スキル化候補・時間消費データを含む）\n- /tmp/skill-insights-session-analysis.md（セッション分析結果 — 注目セッション・タスク混在度を含む）\n- /tmp/skill-insights-pattern-analysis.md（パターン分析結果 — 反復作業パターンを含む）\n\n分析期間: 直近 {DAYS} 日間\n\ndev-workflowプラグインのスキルは以下にある:\n  plugins/dev-workflow/skills/*/SKILL.md\n\n【重要】全バッチファイルをReadで読み込んでから分析を開始すること。\nPhase 2aの全分析結果を入力ソースとして活用すること。特にdomain-analysis.mdの「スキル化ポテンシャル判定」とpattern-analysis.mdの「反復作業パターン」を最優先とする。\n\n結果はMarkdownで /tmp/skill-insights-skill-analysis.md に書き出すこと。"
})
```

エラーが出た場合はユーザーに報告して終了。
skill-analystの結果が返ってきたら、Phase 3へ進む。

## Phase 3: 結果集約＆レポート出力

4つのSubAgentの結果が返ってきたら、以下のフォーマットルールに従ってレポートを出力する。

### セクションヘッダーのフォーマットルール

各セクションの見出しは、以下の形式で装飾して視認性を高めること:

```
---
── {セクション名} ──
---
```

### レポート構成

レポートは**セッション概要 → パターン分析 → ドメイン分析 → スキル提案**の順で構成する。

### 出力手順

以下の全ファイルをReadで読み込み、統合レポートを生成する。
**重要**: SubAgentの出力をそのまま順番に表示するのではなく、重複を排除し、アクション中心に再構成すること。

読み込みファイル:
- /tmp/skill-insights-raw-index.json（基本統計 — meta, session_index用）
- /tmp/skill-insights-metrics.json（基本統計用）
- /tmp/skill-insights-session-analysis.md
- /tmp/skill-insights-pattern-analysis.md
- /tmp/skill-insights-domain-analysis.md
- /tmp/skill-insights-skill-analysis.md

#### 1. エグゼクティブサマリー（最初に表示）

a. **基本統計**: 分析期間、プロジェクト数、セッション数、メッセージ数を1行で表示
b. **総評**: 4つのSubAgentの分析結果を統合し、3-4文で利用状況を総括する。dev-workflowスキルの活用度に焦点を当てること。
c. **トップ3改善ポイント**: スキル提案（セクション5）の上位3つを1行ずつ箇条書き。

フォーマット:
```
分析期間: {from} 〜 {to}（{N}日間） | {M}プロジェクト | {S}セッション | {T}メッセージ

**総評**: {3-4文}

**今すぐ改善できる3つのポイント:**
1. {最重要} → 詳細はスキル提案参照
2. {2番目}
3. {3番目}
```

※ エグゼクティブサマリーは全結果を読んだ後に生成するが、レポートの**最初に表示**する。

#### 2. セッション概要

session-analysis.md の「注目セッション」「タスク混在度」を統合して表示。

```
---
── セッション概要 ──
---

{session-analystの出力を再構成して表示}
```

#### 3. ワークフローパターン

pattern-analysis.md の「ワークフローパターン」「反復作業検出」を表示。

```
---
── ワークフローパターン ──
---

{pattern-analystの出力を再構成して表示}
```

#### 4. 業務ドメイン分析 & スキル化ポテンシャル

domain-analysis.md の「業務ドメイン分類」「時間消費分析」「スキル化ポテンシャル」を一括表示。

```
---
── 業務ドメイン分析 & スキル化ポテンシャル ──
---

{domain-analystの出力を再構成して表示}
```

#### 5. スキル提案

skill-analysis.md の**全内容**（dev-workflowスキル利用状況 + スキル提案カテゴリA・B・C）を表示。

```
---
── スキル提案 ──
---

### dev-workflow スキル利用状況
{skill-analystの分析1をそのまま表示}

### カテゴリA: 新規スキル（痛みスコア降順）
{skill-analystのカテゴリA出力をそのまま表示}

### カテゴリB: 既存スキルのトリガー改善
{skill-analystのカテゴリB出力をそのまま表示}

### カテゴリC: 活用推奨
{skill-analystのカテゴリC出力をそのまま表示}
```

## Phase 4: クリーンアップ

1. 以下の一時ファイルをBashで一括削除: `rm -f /tmp/skill-insights-*.json /tmp/skill-insights-*.md`
2. 完了メッセージ:
   - 分析のハイライト
   - 「定期的に `/skill-insights` で利用パターンの変化を追跡しましょう」
