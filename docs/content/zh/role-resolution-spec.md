# 角色解析规范

## 核心公式

```python
effective_role = max(
    manual_override,
    github_role,
    oidc_role
)

access_allowed = (
    oidc_gate_passed
    AND effective_role != none
)
```text

## 输入项

- `manual_override`：管理员设置的显式例外
- `github_role`：GitHub 权限同步结果
- `oidc_role`：OIDC 组映射带来的提升角色
- `oidc_gate_passed`：OIDC 认证与入口检查通过

## 角色层级

### Workspace

| Rank | Role |
|---|---|
| 3 | owner |
| 2 | admin |
| 1 | member |
| 0 | none |

### Project

| Rank | Role |
|---|---|
| 4 | owner |
| 3 | maintainer |
| 2 | writer |
| 1 | reader |
| 0 | none |

## 同步模式

### `add_only`

- 只做新增和必要升级
- 不做删除和降级

### `add_and_remove`

- 新增/更新/删除全部应用
- owner 保护规则始终生效
