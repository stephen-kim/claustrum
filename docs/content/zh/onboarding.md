# 入门引导

Claustrum 的团队入职流程以“可快速落地 + 可审计”为目标。

## 端到端流程

1. 管理员发起邀请
2. 分享邀请链接
3. 成员打开链接并设置密码
4. 成员登录
5. 完成 Welcome Setup
   - 生成 API key（必需）
   - 配置 Git auto-capture（可选、推荐）

## 邀请 API 流程

- `POST /v1/workspaces/:key/invite`
  - 输入: `email`, `role`, `project_roles?`
  - 输出: `invite_url`, `expires_at`
- `GET /v1/invite/:token`
  - 校验 token 并返回邀请信息
- `POST /v1/invite/:token/accept`
  - 创建/更新用户
  - 分配角色
  - 将 token 标记为已使用

## Welcome Setup

首次登录后若无有效 API key，会进入 Welcome Setup。

步骤 1：
- 生成 API key（明文仅显示一次）

步骤 2（可选）：
- 复制 Git auto-capture 安装命令
- 记录安装状态（写审计）

## 审计事件

- `invite.created`
- `invite.accepted`
- `api_key.created`
- `api_key.revoked`
- `git_capture.installed`

## 安全说明

- 邀请 token 以哈希形式存储
- token 一次性且 24 小时过期
- API key 仅存哈希
- 管理员不可回看历史明文 key

最后更新: 2026-02-19
