# Recent Updates

This page tracks user-visible changes that affect setup, CI reliability, and evaluation workflows.

## 2026-02-18

### CI and test reliability

- Fixed workspace test failure where `@claustrum/shared/dist/index.js` could be missing during `memory-core` unit tests.
- `memory-core` unit tests now build `@claustrum/shared` first, so fresh CI runners no longer fail with `ERR_MODULE_NOT_FOUND`.

### Context Bundle Eval in PRs

- Added Context Bundle Eval suite:
  - `pnpm eval:bundle`
  - `pnpm eval:diff`
- Added PR sticky comment workflow:
  - runs eval on PR head
  - optionally compares with base
  - posts or updates one sticky PR comment with score/failures/budget warnings
  - uploads `report.md`, `scores.json`, and diff artifacts

### Release Gate and QC

- Added release-gate script chain for high-risk checks:
  - bootstrap setup gating
  - workspace isolation
  - RBAC enforcement
  - webhook signature/idempotency
  - secret leakage scanning
- CI now runs release-gate in non-interactive mode with compose cleanup.

### Environment template simplification

- `.env.example` keeps only essentials for startup.
- Full variable reference remains in:
  - `Environment-Variables`

Last Updated: 2026-02-18
