# コンテキスト可視化（Debug）

Claustrum は、運用者向けに Context Debug 画面を提供します。

## 画面位置

Project -> Context Debug

## 主な機能

- bundle preview（`default` / `debug`）
- 解決された workspace/project と monorepo mode
- current subpath シグナル
- 結果ごとの score breakdown（debug 時）
- 最近の decision extraction 結果（result / confidence / error）

## 何に使うか

- なぜ特定 memory が選ばれたかを説明する
- monorepo / subpath 設定の妥当性を検証する
- extractor 品質や ranking drift を診断する

## 注意点

- 目的は観測と調整であり、権限制御の置き換えではありません。
- raw 本文は引き続き保護され、bundle には snippet と evidence 参照のみ表示されます。

最終更新: 2026-02-19
