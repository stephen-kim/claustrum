# Authorization Model Overview

## Architecture Overview

Claustrum enforces strict workspace isolation. Authorization decisions never cross workspace boundaries.

- Workspace isolation is mandatory.
- OIDC handles authentication and workspace entry gating.
- GitHub provides the default project-level authority.
- Manual override is an audited exception path.

### Control Plane Flow

```text
User
  |
  v
OIDC Login (Gate)
  |
  v
Workspace Membership Check
  |
  v
GitHub Permission Sync (Direct + Teams)
  |
  v
Manual Override Layer (Exception)
  |
  v
Effective Role Calculation
  |
  v
Project Access (Allow / Deny)
```

## Source of Truth

> Claustrum treats GitHub as the main source of truth for project-level access.
> OIDC handles authentication and workspace access checks; it is not the main source of project-level authorization.

## Priority Order

Authorization resolves in this order:

- `manual_override`
- `github_derived_role`
- `oidc_boost_role`
- `default_none`

Definitions:

- `manual_override`: explicit exception created by an authorized admin.
- `github_derived_role`: role derived from GitHub direct collaborator and team permissions.
- `oidc_boost_role`: role increase from OIDC group mapping, when policy allows.
- `default_none`: no access.

## Example Scenarios

### 1) GitHub write + no OIDC group

- OIDC gate passes.
- GitHub computes `write`.
- Effective project role becomes `writer`.
- Access is allowed.

### 2) GitHub read + OIDC admin group

- OIDC gate passes.
- GitHub computes `read`.
- OIDC mapping boosts role by policy.
- Effective role is the max of GitHub and OIDC boost.

### 3) Manual override applied

- OIDC gate passes.
- Manual override sets `maintainer` for urgent incident work.
- Effective role follows override.
- Override is audited and treated as temporary policy exception.

### 4) OIDC access check fails

- Authentication fails or workspace gate check fails.
- GitHub-derived role is not evaluated for access grant.
- Access is denied.

### 5) Team membership removed in GitHub

- Webhook event arrives.
- Partial recompute runs for affected repositories.
- Role is reduced or removed according to sync mode and protection rules.

## Operational Rules

- Workspace admin/owner override remains available for controlled operations.
- Owner protection rules prevent accidental owner loss during automated removal.
- All sensitive transitions must be visible in audit logs.
