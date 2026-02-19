# ホーム

Claustrum は、AI チーム向けの共有メモリレイヤーです。  
複数リポジトリ・複数ツール・複数メンバーの間で、作業コンテキストを途切れさせずに維持できます。

## できること

- 構造化メモリの保存と検索（`decision`, `constraint`, `active_work`, `activity`）
- MCP の安全運用（`stdout` は JSON-RPC のみ）
- GitHub 権限・OIDC 認証の連携
- 監査ログ、アクセス履歴、保持ポリシーによる運用
- Context Bundle / Global Rules / Persona / Debug による品質調整

## 最初に読むページ

- [インストール](installation)
- [環境変数](environment-variables)
- [認証戦略](authentication-strategy)
- [運用ガイド](operations)
- [API リファレンス](api-reference)

## 1行 MCP 設定ヘルパー

macOS / Linux:

```shell
curl -fsSL https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -o ./claustrum-mcp-config-helper.js && node ./claustrum-mcp-config-helper.js
```markdown

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/stephen-kim/claustrum/main/scripts/mcp-config-helper.js -OutFile .\claustrum-mcp-config-helper.js; node .\claustrum-mcp-config-helper.js
```

## コンポーネント

- `memory-core`: REST API + Postgres + ポリシーエンジン
- `mcp-adapter`: MCP stdio ブリッジ（memory-core 呼び出し）
- `admin-ui`: ワークスペース/権限/連携/監査の運用コンソール
