# 角色画像（Persona）

Persona 用来决定“当前用户更应该看到哪类上下文”。
它不会改变权限或角色。

## Persona 模式

- `neutral`（默认）: 平衡模式，轻微提升 active work
- `author`: 偏实现（更看重 active work / recent activity）
- `reviewer`: 偏评审（更看重 constraints / decisions）
- `architect`: 偏架构（更看重 decisions / constraints）

## 推荐机制（仅建议）

- `GET /v1/context/persona-recommendation?workspace_key=...&project_key=...&q=...`
- 只给推荐，不会自动切换。
- 最终以用户手动选择为准。

## 应用流程

1. 打开 Context Debug
2. 用当前问题运行推荐
3. 需要时点击 `Apply Recommended Persona`

变更会写入审计事件 `user.persona.changed`。

最后更新: 2026-02-19
