# Onboarding

Claustrum onboarding is designed for team onboarding with minimal manual steps.

## End-to-end flow

1. Admin invites a member from Workspace Members.
2. Admin shares the generated invite link.
3. Member opens invite link and sets password.
4. Member signs in.
5. Welcome Setup asks member to:
   - generate API key (required)
   - install Git auto-capture (optional, recommended)

## Invite API flow

- `POST /v1/workspaces/:key/invite` (workspace admin+)
  - input: `email`, `role`, optional `project_roles`
  - output: `invite_url`, `expires_at`
- `GET /v1/invite/:token`
  - validates token and returns invite metadata
- `POST /v1/invite/:token/accept`
  - creates/updates user password profile
  - assigns workspace role + optional project roles
  - marks token as used

## Welcome Setup

After first login, users without active API keys are redirected to Welcome Setup.

Step 1:
- Generate API key (one-time view in UI)

Step 2 (optional):
- Copy Git auto-capture install command
- mark installed (writes audit record)

## Audit events

- `invite.created`
- `invite.accepted`
- `api_key.created`
- `api_key.revoked`
- `git_capture.installed`

## Roles during onboarding

- Workspace roles: `OWNER`, `ADMIN`, `MEMBER`
- Project roles: `OWNER`, `MAINTAINER`, `WRITER`, `READER`
- Invite can set workspace role and optional per-project role map (`project_roles`).

## Security notes

- Invitation tokens are stored hashed in DB.
- Tokens are one-time and expire in 24 hours.
- API keys are stored hashed only.
- Admin cannot retrieve existing plaintext API keys.
