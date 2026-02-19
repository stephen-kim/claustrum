# 認証戦略

Claustrum は段階的に認証を強化する設計です。  
現在は運用のシンプルさを重視し、Phase 1 として API key を採用しています。

## Phase 1（現在）: API Key

- 認証方式: `Authorization: Bearer <api_key>`
- キーは「発行時に 1 回だけ表示」
- 失効（revoke）可能
- 管理者の reset は one-time link 経由

サーバー保存:
- 平文 key は DB に保存しない
- `key_hash` のみ保存
- 表示用に `key_prefix` を保持
- `device_label` は必須
- `expires_at` は任意で設定可能

スコープ:
- API key は workspace 単位（`workspace_id`）
- 他 workspace へのアクセスは拒否

ローカル保存（MCP adapter）:
- `~/.claustrum/state.json`
- 書き込み時に `chmod 600` を強制
- 緩い権限なら警告し、可能な範囲で自動補正

セキュリティ動作:
- key / token はログに出さない
- debug/error でも機密情報はマスク
- 401/403 では再ログイン案内を返す

監査イベント:
- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## Phase 1 のメリット

- 導入が速い
- ローカル/リモートの adapter 運用どちらにも対応しやすい
- CLI 利用で外部 IdP 依存を最小化できる

## Phase 1 の制約

- `state.json` に平文 key を保存（Phase 1 の割り切り）
- `expires_at` を使わない場合は長寿命キーになりやすい

## Phase 2（計画）: Device Flow + Keychain

- OAuth Device Flow を導入
- 短寿命 access token + 回転 refresh token
- refresh token は OS keychain に保存
- デバイス単位 revoke とセッション管理を強化

互換性:
- 既存 API key ユーザーは継続利用可能
- 新規ログインは段階的に Device Flow を推奨

## 移行ステップ

1. API key endpoint と audit の互換性を維持
2. Device Flow endpoint を追加
3. adapter 側に credential provider 抽象化を導入
4. `state.json` key から keychain ベースへ移行
5. 互換期間中は API key fallback を維持
