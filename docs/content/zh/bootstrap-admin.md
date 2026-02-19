# 初始管理员设置

Claustrum 提供首次安装时的 bootstrap admin 流程。

## 初始账号

- 首个管理员邮箱固定为 `admin@example.com`
- 仅当 `users` 表为空时才会执行 bootstrap
- 初始密码只会在服务器日志中输出 **一次**

示例输出：

```text
Bootstrap admin created: admin@example.com
Initial password (shown once): <random-password>
```

## 首次登录后必须完成

使用 bootstrap 账号登录后，在完成 setup 前无法使用大部分功能：

1. 修改邮箱（必填，不能继续使用 `admin@example.com`）
2. 修改密码（必填）
3. 设置显示名（可选）

setup 完成前只允许：
- `/v1/auth/me`
- `/v1/auth/complete-setup`
- `/v1/auth/logout`

其他 `/v1/*` API 一律返回 `403`。

## 重装 / 重置行为

- 如果 DB 被清空且 `users` 为空，会再次触发 bootstrap 并输出新的一次性密码
- 只要已有任意用户，bootstrap 就不会再次执行

## 安全建议

- 把 bootstrap 密码日志当作敏感信息处理
- 首次登录后立即改为正式密码
- 不要公开暴露启动日志
