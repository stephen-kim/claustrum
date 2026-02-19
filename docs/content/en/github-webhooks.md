# GitHub Webhooks


## Scope

Webhook automation processes GitHub events and applies only the required sync work (repo sync, team mapping, partial permission recompute).

Implemented:

- `POST /v1/webhooks/github` with signature verification (`X-Hub-Signature-256`)
- queue-first ingestion in `github_webhook_events`
- in-process async worker (`queued -> processing -> done|failed`)
- automatic repo sync on `installation_repositories`
- optional team mapping application on `team` / `membership`
- repository rename cache update on `repository`
- partial permission recompute only for affected repos ([details](github-partial-recompute))


## Security

- Secret source: `GITHUB_APP_WEBHOOK_SECRET` (env only)
- Invalid/missing signature: rejected before enqueue
- Delivery id dedupe: unique `delivery_id` in DB
- Worker uses retry-safe status transitions with up to 3 retries


## Event Flow

```mermaid
flowchart LR
  GH["GitHub App Webhook"] --> API["POST /v1/webhooks/github"]
  API --> SIG["Verify signature"]
  SIG --> Q["Insert github_webhook_events(status=queued)"]
  Q --> ACK["200 OK immediately"]
  Q --> W["Background worker"]
  W --> EV1["installation_repositories -> sync repos"]
  W --> EV2["team/membership -> apply team mappings"]
  W --> EV3["repository renamed -> update repo links"]
  W --> DONE["status=done or failed"]
```


## Workspace Controls

Workspace settings:

- `github_webhook_enabled` (default `false`)
- `github_webhook_sync_mode` (`add_only` | `add_and_remove`, default `add_only`)
- `github_team_mapping_enabled` (default `true`)

If webhook is disabled for a workspace, queued deliveries are acknowledged but ignored by sync logic.


## Admin UI

Location: **Workspace -> Integrations -> GitHub**

- webhook sync toggle/mode
- team mapping enable toggle
- webhook endpoint hint (`/v1/webhooks/github`)
- recent deliveries table (`queued/processing/done/failed`)


## Troubleshooting

- `Invalid GitHub webhook signature`:
  - check App webhook secret matches `GITHUB_APP_WEBHOOK_SECRET`
- deliveries stay `failed`:
  - check `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY`
  - ensure installation is connected to the workspace
- no team-based role changes:
  - ensure `github_team_mapping_enabled=true`
  - ensure mappings exist and linked users are configured (`github_user_links`)
