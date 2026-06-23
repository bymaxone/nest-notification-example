# Contributing to nest-notification-example

Thank you for your interest in contributing! This repository is the public
reference application for `@bymax-one/nest-notification`. By participating you
agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Reporting security issues

**Do not open public issues for security vulnerabilities.** Follow the private
reporting process in [SECURITY.md](./SECURITY.md).

## The bar for a change

Every change must make the library **clearer to learn or more completely
demonstrated** — see [docs/OVERVIEW.md §20](docs/OVERVIEW.md#20-contributing). A
new library feature means a new Feature Coverage Matrix row **and** a
browser-reachable way to exercise it, not just a probe reference.

## Prerequisites

- Node.js >= 24 (`.nvmrc` pins `24`)
- pnpm >= 11 (managed via the `packageManager` field)

## Getting started

```bash
# Build the sibling library first (consumed pre-publish via file: — must be built before pnpm install)
cd ../nest-notification && pnpm install && pnpm build && cd ../nest-notification-example

pnpm install
pnpm infra:up        # local Postgres + Redis + Mailpit (added with the app)
pnpm dev             # starts the API + console once those apps are added (a no-op until then)
```

`@bymax-one/nest-notification` is consumed pre-publish via `file:../../../nest-notification`.
Build that sibling checkout before running `pnpm install` here — the library ships no
`dependencies`, resolving only from its built `dist/` via the `exports` map. Rebuild with
`pnpm -C ../nest-notification build` whenever the library source changes. Use `file:` (not
`link:`) to avoid pulling the sibling tree into every test worker's module graph.

## Verification — run before every PR

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:cov && pnpm audit:exports && pnpm audit:error-codes
```

All of the following must be green:

- **Typecheck** — `tsc --noEmit` (strict, zero errors, zero `any`).
- **Lint** — ESLint flat config, `--max-warnings 0`, no suppression comments.
- **Format** — Prettier (`format:check` clean).
- **Coverage** — 100% statements / branches / functions / lines in both apps.
- **Audits** — every public export referenced in `apps/**`; every error code
  localized in `apps/web`.

Mutation testing (Stryker, `break: 95`) runs per PR on changed workspaces and
nightly — never fan out parallel test agents; this repo links the library
locally and duplicates it across workers, so run suites sequentially with
bounded workers.

## Commits — Conventional Commits

Commit messages are validated by commitlint via the `commit-msg` hook:

```
<type>(<scope>): <subject>
```

Types: `feat | fix | docs | refactor | perf | test | build | ci | chore | revert`.
Scopes: `api | web | ci | docs | infra`. **No `Co-Authored-By` trailer.** The
`pre-commit` hook runs lint-staged (Prettier + ESLint on staged files).

## Pull requests

- Keep PRs focused; one phase of work per PR.
- Record user-facing changes under `## [Unreleased]` in
  [CHANGELOG.md](./CHANGELOG.md).
- All CI checks (`ci`, `codeql`, `scorecard`) must be green before merge.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
