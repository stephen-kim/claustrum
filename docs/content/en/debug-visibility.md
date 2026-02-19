# Context Debug Visibility

Claustrum includes an admin-focused context debug surface in Admin UI.

## Admin UI Screen

Project -> Context Debug

Features:

- Bundle preview (`default` / `debug`)
- Resolved workspace/project and monorepo mode
- Current subpath signal
- Per-result score breakdown in debug mode
- Recent decision extraction outcomes (result, confidence, error)

## Purpose

- Explain why a memory/result was selected.
- Validate monorepo mode and subpath handling.
- Diagnose extractor quality and ranking drift.

## Notes

- Debug views are for observability and tuning.
- Raw full-text content remains guarded; bundle shows concise snippets + evidence refs.

Last Updated: 2026-02-17
