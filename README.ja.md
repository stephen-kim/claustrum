# Claustrum

[English README](README.md) | [한국어 README](README.ko.md) | [日本語 README](README.ja.md) | [Español README](README.es.md) | [中文 README](README.zh.md)

Claustrum は AI システム向けの共有メモリレイヤーです。プロジェクト、ツール、チーム間でコンテキストを統合します。


## このプロジェクトでできること

- 複数の PC と複数の開発者間でメモリコンテキストを共有します。
- MCP ワークフローを本番運用向けに安全化します（`stdout` クリーン、ポリシー駆動）。
- Admin UI でワークスペース、プロジェクト、ユーザー、権限、監査ログを管理できます。
- 外部コンテキスト（Notion、Jira、Confluence、Linear、Slack）と連携できます。


## なぜ必要か

AI コーディングのコンテキストは分断されがちです。

- マシンごとに記憶状態が異なる
- メンバーごとに見えている文脈が異なる
- 重要な意思決定がコミット、チャット、ドキュメントに散らばる

Claustrum はこれをチームで共有できる検索可能なメモリシステムに変えます。


## コアコンポーネント

- **Memory Core**: REST API + ポリシー + Postgres ストレージ
- **MCP Adapter**: Memory Core を呼び出す stdio MCP ブリッジ
- **Admin UI**: チーム運用向け管理ダッシュボード
- **Shared Package**: 共通スキーマ、型、ユーティリティ


## ドキュメント方針（Pages優先）

この README は概要のみです。詳細なセットアップ、設定、運用手順は GitHub Pages で公開し、ソースは `docs/content` で管理します。

- [Docs Site (GitHub Pages)](https://stephen-kim.github.io/claustrum/)


## リポジトリ構成

```text
apps/
  docs-site/
  memory-core/
  mcp-adapter/
  admin-ui/
packages/
  shared/
```


## Upstream

- Upstream (`upstream`): `https://github.com/Intina47/context-sync.git`
