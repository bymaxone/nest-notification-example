# Agent guide

This repository's full agent contract lives in **[CLAUDE.md](./CLAUDE.md)** — it is tool-agnostic and applies to any
AI assistant (Claude Code, GitHub Copilot, and others). Read it before making changes.

`nest-notification-example` is the public reference application for `@bymax-one/nest-notification`. The product
blueprint is [docs/OVERVIEW.md](docs/OVERVIEW.md); the phased build plan and quality gates are
[docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

## Gate cheat-sheet (run before every PR)

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm audit:exports && pnpm audit:error-codes
```

## The rules that bite most often

- Zero `any`, zero suppression comments; ESLint `--max-warnings 0`.
- Never log or return an OTP code; mask recipient addresses; resolve the tenant from a trusted source.
- The shared design-system files are copied **byte-identical** from `nest-logger-example` — never re-styled.
- Run test suites **sequentially with bounded workers**; never fan out parallel test agents (the locally linked
  library is duplicated across workers and exhausts memory).
- Conventional Commits, scopes `api | web | ci | docs | infra`, **no `Co-Authored-By` trailer**.
- English-only, timeless comments — no plan-stage references in committed files.

Everything above is expanded, with the stack and the full cheat-sheet, in [CLAUDE.md](./CLAUDE.md).
