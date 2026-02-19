# 初始上下文（Bootstrap）

Bootstrap Context 会在项目创建后立即生成最小可用上下文。

## 触发时机

- 自动：项目创建流程（best-effort）
- 手动 API：`POST /v1/projects/:key/bootstrap`
- Admin UI：Project Settings 中的 `Bootstrap context` 按钮

## 数据来源

可用时会读取：

- `README.md`
- `package.json`
- `docker-compose.yml` / `docker-compose.yaml`
- `infra/docker-compose.yml` / `infra/docker-compose.yaml`
- 最近 Git raw events（`post_commit`, `post_merge`, `post_checkout`）

## 输出 memory

- `type`: `summary`
- `status`: `confirmed`
- `source`: `auto`
- `metadata.source`: `bootstrap`
- `metadata.files`: 使用到的文件列表

## 失败处理

- bootstrap 不阻塞主流程。
- 文件缺失也不会影响项目可用性。
- 可以随时手动重试。

最后更新: 2026-02-19
