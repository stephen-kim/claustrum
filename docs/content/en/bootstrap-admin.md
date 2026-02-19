# Bootstrap Admin Setup

Claustrum supports a first-run bootstrap admin flow for clean initial installation.

## Initial account

- Email is fixed on first bootstrap: `admin@example.com`
- Bootstrap runs only when `users` table is empty.
- Server prints initial password once to server log stream.

Example output:

```text
Bootstrap admin created: admin@example.com
Initial password (shown once): <random-password>
```

## First login requirement

After login with bootstrap credentials, setup must be completed before using the platform:

1. Change email (required, cannot stay `admin@example.com`)
2. Change password (required)
3. Set display name (optional)

Until setup is completed:
- `/v1/auth/me`, `/v1/auth/complete-setup`, `/v1/auth/logout` are allowed.
- Other `/v1/*` APIs are blocked with `403`.

## Reinstall / reset behavior

- If DB is reset and `users` is empty again, bootstrap will run again and print a new one-time password.
- If any user already exists, bootstrap does not run and no password is printed.

## Security recommendations

- Treat bootstrap password output as sensitive secret material.
- Rotate to a real personal password immediately.
- Prefer secure log sinks and avoid exposing startup logs publicly.
