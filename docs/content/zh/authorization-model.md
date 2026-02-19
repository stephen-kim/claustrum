# 授权模型总览

## 核心原则

Claustrum 的授权策略如下：

- 严格工作区隔离
- 项目级权限以 GitHub 为主权威
- OIDC 负责认证与入口门控
- 手动覆盖属于例外路径，必须审计

## 流程

```text
User
  ↓
OIDC Login (Gate)
  ↓
Workspace Membership Check
  ↓
GitHub Permission Sync
  ↓
Manual Override
  ↓
Effective Role
  ↓
Project Access
```text

## 优先级

1. `manual_override`
2. `github_derived_role`
3. `oidc_boost_role`
4. `default_none`

## 典型场景

- GitHub `write` + 无 OIDC 组 -> `writer`
- GitHub `read` + OIDC 提升 -> 取更高角色
- 手动覆盖存在 -> 以覆盖结果为准
- OIDC gate 失败 -> 直接拒绝访问

## 运维建议

- 启用 owner 保护，防止误删
- 手动覆盖要有时效并可追溯
- 敏感变更必须在审计中可见
