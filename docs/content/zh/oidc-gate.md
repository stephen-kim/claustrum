# OIDC 网关

在 Claustrum 里，OIDC 负责“身份认证 + workspace 入口校验”。
项目级权限的主权威仍然是 GitHub。

## OIDC 的职责

- 校验用户身份
- 建立 workspace 级会话信任
- 在项目角色计算前先做访问 gate

OIDC 很重要，但不替代 GitHub 的代码权限模型。

## 身份主键

OIDC 身份以以下元组识别：

```text
(issuer, subject)
```

- email 可变，不作为主键。

## Group Mapping

- 优先使用稳定的 `group id`
- `group_display_name` 只用于 UI 展示
- group mapping 可作为加权信号，但项目权限主来源仍是 GitHub

## Sync Mode

| 模式 | 含义 |
| --- | --- |
| `add_only` | 只增加 OIDC 映射带来的授权，保留其他已有授权 |
| `add_and_remove` | 按当前映射做增删（受保护规则约束） |

## 为什么不是 OIDC 主授权

- OIDC 擅长 SSO 与身份生命周期
- GitHub 更贴近实际代码所有权与仓库权限
- 手工 override 作为例外路径并保留审计

## Guardrails

- OIDC gate 失败时，直接拒绝访问
- identity link 按 workspace 隔离
- group claim 格式不匹配视为配置风险
