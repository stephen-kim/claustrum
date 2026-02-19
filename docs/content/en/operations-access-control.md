# Operations Access Control

## Objective

This runbook defines the operational sequence for stable workspace onboarding and access control management.

## New Workspace Onboarding

1. Create workspace.
2. Connect GitHub App installation for the workspace.
3. Run repo sync.
4. Confirm repo -> project links.
5. Run permission sync (dry-run, then apply).
6. Connect OIDC provider and validate login access checks.
7. Configure group mappings (boost policy only).
8. Verify audit trail for setup actions.

## GitHub Setup Procedure

### Install and Sync

1. Open workspace GitHub integration page.
2. Connect installation.
3. Click sync repos.
4. Verify linked projects.

### Permission Sync

1. Run dry-run.
2. Review unmatched users.
3. Link users (`Claustrum user <-> GitHub login`).
4. Run apply sync.

## OIDC Setup Procedure

1. Configure OIDC provider metadata.
2. Validate issuer and client configuration.
3. Validate `(issuer, subject)` identity creation.
4. Configure group mapping with stable group IDs.
5. Confirm OIDC access-check enforcement on protected endpoints.

## Team Mapping Procedure

1. Register team mapping rules.
2. Set target scope (workspace/project).
3. Set role and priority.
4. Trigger sync or wait for webhook-driven recompute.
5. Validate resulting memberships.

## Incident Debugging Order

Use this order to reduce diagnostic noise:

1. Confirm OIDC access-check success for the user.
2. Confirm workspace membership.
3. Confirm GitHub installation exists and is healthy.
4. Confirm repo is synced and linked.
5. Confirm GitHub user link exists.
6. Inspect permission preview for direct/team max result.
7. Inspect webhook deliveries (`queued/processing/done/failed`).
8. Inspect recompute audits and permission apply audits.

## Audit Log Checks

Critical action keys to monitor:

- `github.webhook.received`
- `github.webhook.signature_failed`
- `github.repos.synced`
- `github.repos.synced.webhook`
- `github.permissions.computed`
- `github.permissions.applied`
- `github.permissions.recomputed`
- `github.user_link.created`
- `github.user_link.deleted`

## Operational Safeguards

- Keep `add_only` as default for initial rollout.
- Use `add_and_remove` after audit confidence is established.
- Keep owner protection enabled.
- Use partial recompute to limit the impact scope.

Last Updated: 2026-02-17
