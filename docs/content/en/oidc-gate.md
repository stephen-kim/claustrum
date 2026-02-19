# OIDC Gate

## Role of OIDC in Claustrum

OIDC is the authentication layer and workspace access check.

- OIDC validates identity.
- OIDC establishes workspace-level session trust.
- OIDC does not replace GitHub as the primary source of project authorization.

## Identity Key

Claustrum identifies OIDC users by immutable identity tuple:

```text
(issuer, subject)
```

Email is mutable and is not used as the primary identity key.

## Group Claim Mapping

Group mapping is supported as a policy signal.

- Prefer stable group ID over group name.
- Group display name is UI-only metadata.
- Mappings can raise access by policy, but GitHub remains the primary source for project access.

## Sync Modes

| Mode | Meaning |
|---|---|
| `add_only` | Grants from OIDC mappings are added. Existing unrelated grants are preserved. |
| `add_and_remove` | Grants are reconciled to current mapping state, subject to protection rules. |

## Why OIDC Is Not Primary Authorization

Claustrum uses GitHub as the project authority to stay aligned with repository ownership.

- GitHub is the operational source for repository permissions.
- OIDC groups are organizational and may not represent code ownership accurately.
- OIDC remains critical for reliable identity checks and workspace access control.

## Enterprise Meaning

In enterprise deployment, this split model provides:

- SSO compliance and centralized identity lifecycle through OIDC.
- Precise repository authorization through GitHub permission graph.
- Controlled exceptions via manual access overrides with audit logs.

## Guardrails

- OIDC gate failure denies access before project role evaluation.
- Identity links are tenant-scoped by workspace.
- Group-claim format mismatch must be treated as configuration risk.
