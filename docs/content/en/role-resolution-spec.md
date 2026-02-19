# Role Resolution Specification

## Core Formula

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
```

## Resolution Inputs

- `manual_override`: explicit admin-managed exception.
- `github_role`: resolved from GitHub permission sync.
- `oidc_role`: OIDC group-derived boost role.
- `oidc_gate_passed`: authentication + workspace gate success.

## Role Hierarchy

### Workspace Roles

| Rank | Role |
|---|---|
| 3 | owner |
| 2 | admin |
| 1 | member |
| 0 | none |

### Project Roles

| Rank | Role |
|---|---|
| 4 | owner |
| 3 | maintainer |
| 2 | writer |
| 1 | reader |
| 0 | none |

## Conflict Resolution Rules

1. Compare roles by rank.
2. Select highest rank as `effective_role`.
3. If the OIDC access check fails, deny access regardless of computed role.
4. Apply workspace isolation before role checks.

## Owner Protection Rule

Automatic sync cannot remove critical ownership blindly.

- Project owner removal by automation is blocked when protection rule is active.
- Workspace owner/admin override remains valid for emergency operations.

## `add_and_remove` Behavior

`add_and_remove` applies full reconciliation:

- add missing grants from source
- update changed grants
- remove stale grants
- skip protected owner removals

`add_only` applies additive sync:

- add missing grants
- upgrade when needed
- do not remove stale entries

## Manual Override Policy

Manual override is for exceptions only.

- It outranks derived grants.
- It must be auditable.
- It should be time-bounded in operations policy.
