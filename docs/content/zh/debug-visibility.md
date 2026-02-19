# 上下文可观测性（Debug）

Claustrum 提供面向运维的 Context Debug 可视化页面。

## 页面位置

Project -> Context Debug

## 主要功能

- bundle 预览（`default` / `debug`）
- 解析后的 workspace/project 与 monorepo mode
- 当前 subpath 信号
- 结果级 score breakdown（debug 模式）
- 最近 decision extraction 结果（result/confidence/error）

## 典型用途

- 解释某条结果为何入选
- 校验 monorepo/subpath 策略是否生效
- 排查 ranking 漂移与 extractor 质量问题

## 说明

- 该页面用于观测与调参，不改变权限模型。
- raw 全文依旧受保护，只展示 snippet 与 evidence 引用。

最后更新: 2026-02-19
