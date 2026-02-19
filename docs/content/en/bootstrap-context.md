# Bootstrap Context

Bootstrap context creates minimum durable memory immediately after project creation.

## Trigger Points

- Automatic: project creation flow (best-effort)
- Manual: `POST /v1/projects/:key/bootstrap`
- Admin UI: Project settings `Bootstrap context` button

## Sources

Bootstrap collector samples these local signals when available:

- `README.md`
- `package.json`
- `docker-compose.yml` / `docker-compose.yaml`
- `infra/docker-compose.yml` / `infra/docker-compose.yaml`
- Recent Git raw events (`post_commit`, `post_merge`, `post_checkout`)

## Output Memory

- `type`: `summary`
- `status`: `confirmed`
- `source`: `auto`
- `metadata.source`: `bootstrap`
- `metadata.files`: list of detected file signals

## Failure Model

- Bootstrap is non-blocking.
- If source files are missing or unreadable, the project still works.
- Bootstrap can be retried manually.

Last Updated: 2026-02-17
