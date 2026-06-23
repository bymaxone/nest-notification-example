# Phase 0 — Foundation, Tooling & CI Skeleton

> **Status**: 🔄 In Progress · **Progress**: 5 / 7 tasks · **Last updated**: 2026-06-23
> **Source roadmap**: [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) § P0
> **Source spec**: [`docs/OVERVIEW.md`](../OVERVIEW.md)
> **Executing a task?** Read **only** that task's `### Task N.n` block + its bounded _REQUIRED READING_ — never the whole file. See [token economy](README.md#token-economy--executing-a-single-task).

---

## Context

The repository currently contains only `docs/OVERVIEW.md` (the master blueprint), `docs/DEVELOPMENT_PLAN.md` (the
roadmap), `docs/design_system.html` (the shared design system, already present), and `docs/tasks/`. There is no
`apps/` code, no toolchain, and no CI.

Phase 0 produces a **building, fully-gated, empty pnpm monorepo**: the workspace + TypeScript toolchain, the lint /
format / commit governance, every mandatory repo and community-health file, the **complete CI/CD pipeline** (the four
sibling workflows **plus** the go-public hardening — CodeQL, OpenSSF Scorecard, dependency-review, secret-scan), the
GitHub Copilot review configuration, and the audit-script stubs. When P0 is done, `pnpm install --frozen-lockfile`,
`pnpm typecheck`, `pnpm lint`, and `pnpm format:check` all pass on the empty workspace, `ci.yml` runs green on a PR, the
security workflows run, `release.yml` validates without publishing, and the repo carries everything it needs to be made
public. **No application logic is written in this phase.** The verbatim copy of the design-system _web_ files
(`globals.css`, `tailwind.config.ts`, `components.json`, `components/ui/*`) belongs to **P8** (it needs `apps/web`);
`docs/design_system.html` is already the reference here.

The gold sources for the actual file contents are the sibling repos — copy and **adapt** their proven configs rather
than inventing: `nest-logger-example` and `nest-auth-example` (both under `~/Documents/MyApps/bymax-one/`).

---

## Rules-of-phase

1. **No application code** — only workspace metadata, tooling config, governance/docs files, CI, and script stubs.
2. **Copy-and-adapt the siblings** — `nest-logger-example` / `nest-auth-example` are the proven sources for every
   config file; do not hand-roll from memory. Re-verify current tool docs via context7 where a version moved.
3. **No `.gitkeep` / `.keep` / empty-directory placeholders** — directories emerge from real files only. Do **not**
   pre-create `apps/`, `scripts/` unless a task writes a real file into them.
4. **Timeless, English-only** — no `Phase N` / `Task` / roadmap-stage references in any committed file (code, config,
   `.github/**` docs-as-config). Doc-section refs (`OVERVIEW.md §6`) are allowed.
5. **CI job names are contractual** — branch protection and the export-usage check reference them by name. Use the job
   names defined in [Appendix D](../DEVELOPMENT_PLAN.md#appendix-d--cicd-workflow-matrix).
6. **Least-privilege CI** — top-level `permissions: contents: read`; jobs widen only what they need; `concurrency`
   cancel-in-progress (except `release`); pinned action versions + pinned pnpm/Node; `timeout-minutes` on every job;
   untrusted `${{ }}` passed via `env:`, never interpolated into a script body.
7. **Conventional Commits**, enforced locally (commitlint + husky); **no `Co-Authored-By` trailer**.
8. **Versions** — Node 24 (LTS), pnpm 11.x, TypeScript 5.9, per [`OVERVIEW.md §4`](../OVERVIEW.md#4-tech-stack).

---

## Reference docs

- [`OVERVIEW.md`](../OVERVIEW.md) — §4 Tech Stack, §5 Repository Layout, §7 Library Consumption, §8 Local Stack.
- [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — § P0, §2 Global Conventions, §3 Autonomous Execution Model,
  Appendix C (Quality Gates), Appendix D (CI Matrix), Appendix E (Go-Public Checklist).
- Sibling repos (gold config sources): `~/Documents/MyApps/bymax-one/nest-logger-example/` and
  `~/Documents/MyApps/bymax-one/nest-auth-example/` — their `package.json`, `tsconfig.base.json`, `eslint.config.mjs`,
  `.prettierrc.mjs`, `commitlint.config.mjs`, `.husky/`, `.github/`, `scripts/audit-*.mjs`, `renovate.json`.
- `/bymax-workflow:standards` skill — universal coding rules.
- Vault: [[Example-App-Standard]], [[GitHub-Actions/Bymax-Conventions]], [[Bymax-Lib-Standards/README-Badges]].

---

## Task index

| ID  | Task                                              | Status  | Priority | Size | Depends on |
| --- | ------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 0.1 | pnpm workspace + TypeScript foundation            | ✅ Done | P0       | M    | —          |
| 0.2 | Lint, format & commit governance                  | ✅ Done | P0       | S    | 0.1        |
| 0.3 | Mandatory repo & community-health files           | ✅ Done | P1       | S    | 0.1        |
| 0.4 | GitHub config & Copilot review                    | ✅ Done | P0       | M    | 0.1        |
| 0.5 | Core CI workflow + audit-script stubs             | ✅ Done | P0       | M    | 0.1, 0.2   |
| 0.6 | Security & supply-chain workflows                 | 📋 ToDo | P0       | M    | 0.5        |
| 0.7 | Mutation/release workflow skeletons + Dockerfiles | 📋 ToDo | P1       | M    | 0.5        |

---

## Tasks

### Task 0.1 — pnpm workspace + TypeScript foundation

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: —

#### Description

Create the pnpm monorepo root and the shared TypeScript configuration so the workspace installs and typechecks on an
empty tree, ready for `apps/*` to be added later.

#### Acceptance criteria

- [x] `pnpm install --frozen-lockfile` succeeds on the empty workspace.
- [x] `pnpm-workspace.yaml` declares `packages: ['apps/*']`; root `package.json` sets `packageManager: pnpm@11.x`,
      `engines: { node: '>=24', pnpm: '>=11' }`, `"type": "module"`, and the root scripts (`typecheck`, `lint`,
      `format`, `format:check`, `test:cov`, `audit:exports`, `audit:error-codes`, `infra:up`, `infra:down` — placeholders
      that no-op or fan out with `pnpm -r --workspace-concurrency=1`).
- [x] `tsconfig.base.json` enables `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
      `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`,
      `moduleResolution: Bundler`, `target/lib` for Node 24.
- [x] `.nvmrc` = `24`; `.npmrc` has `frozen-lockfile=true`; `.editorconfig`, `.gitignore`, `.gitattributes` present.
- [x] `pnpm typecheck` exits 0 (a root `tsconfig.json` with `"files": []` to avoid TS18003 on the empty tree).

#### Files to create / modify

- `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `tsconfig.json`
- `.nvmrc`, `.npmrc`, `.editorconfig`, `.gitignore`, `.gitattributes`

#### Agent prompt

```
You are a senior TypeScript build/tooling engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — the public reference app for the @bymax-one/nest-notification library
(NestJS 11 notification lib: email + OTP, multi-tenant, pluggable providers). pnpm monorepo, Node 24, TypeScript 5.9
strict; apps/api (NestJS) + apps/web (Next.js 16) will be added in later phases.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.1 of 7 (FIRST)

PRECONDITIONS
- The repo contains only docs/ (OVERVIEW.md, DEVELOPMENT_PLAN.md, design_system.html, tasks/). No code, no tooling.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "4. Tech Stack" and § "5. Repository Layout" (the target tree + versions).
- docs/DEVELOPMENT_PLAN.md § "2. Global Conventions" (the workspace/TS/install rules).
- The sibling files (copy & adapt, do NOT invent): ~/Documents/MyApps/bymax-one/nest-logger-example/
  {pnpm-workspace.yaml, package.json, tsconfig.base.json, .npmrc, .nvmrc, .editorconfig, .gitignore}.

TASK
Scaffold the pnpm workspace root + shared TypeScript config so the empty workspace installs and typechecks.

DELIVERABLES
1. `pnpm-workspace.yaml` — `packages: ['apps/*']`.
2. `package.json` (root) — private, "type":"module", packageManager "pnpm@11.x", engines node>=24/pnpm>=11, the
   root scripts listed in the acceptance criteria (placeholders that recurse with
   `pnpm -r --workspace-concurrency=1 --if-present run <script>`).
3. `tsconfig.base.json` — the strict flag set from § Global Conventions; `tsconfig.json` at root with `"files": []`
   (avoids TS18003 until apps/ exist).
4. `.nvmrc` (`24`), `.npmrc` (`frozen-lockfile=true`, `engine-strict=true`), `.editorconfig`, `.gitattributes`,
   `.gitignore` (node_modules, dist, .next, coverage, .env, reports/).

Constraints:
- No apps/ directory yet (do not pre-create empty dirs; no .gitkeep). Follow /bymax-workflow:standards.
- English-only, timeless comments; no Phase/task references.

Verification:
- `pnpm install --frozen-lockfile` — expected: completes, writes pnpm-lock.yaml.
- `pnpm typecheck` — expected: exits 0 (no files matched, no TS18003).
- `node -v` matches `.nvmrc` (24.x).

Completion Protocol (run after finishing — keeps the dashboards honest):
1. Set this task's Status to ✅ in its block AND the Task index row.
2. Tick the satisfied acceptance-criteria checkboxes.
3. Update the file-header Progress to `1 / 7` and Last updated to today.
4. Update the P0 row Progress to `1 / 7` in docs/DEVELOPMENT_PLAN.md.
5. Append to Completion log: `- 0.1 ✅ <YYYY-MM-DD> — pnpm workspace + TS foundation`.
6. Commit: `chore(workspace): scaffold pnpm monorepo + tsconfig base` (no Co-Authored-By).
```

---

### Task 0.2 — Lint, format & commit governance

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1

#### Description

Wire ESLint (flat, type-aware), Prettier, commitlint, husky, and lint-staged so style and commit conventions are
enforced locally and in CI.

#### Acceptance criteria

- [x] `eslint.config.mjs` (flat) uses `typescript-eslint` `recommendedTypeChecked` via the project service,
      `eslint-config-prettier` last, type-aware rules scoped to TS, relaxed unsafe/any rules only in test globs; runs with
      `--max-warnings 0`.
- [x] `.prettierrc.mjs` + `.prettierignore` present; `pnpm format:check` passes on the tree.
- [x] `commitlint.config.mjs` extends `@commitlint/config-conventional`; `.gitmessage` documents allowed type/scope.
- [x] `.husky/pre-commit` → `lint-staged`; `.husky/commit-msg` → `commitlint --edit`; `lint-staged.config.mjs` runs
      `prettier --write` + `eslint --fix` on staged files.
- [x] `.markdown-link-check.json` present.
- [x] `pnpm lint` and `pnpm format:check` exit 0; a non-conventional commit message is rejected by the hook.

#### Files to create / modify

- `eslint.config.mjs`, `.prettierrc.mjs`, `.prettierignore`, `commitlint.config.mjs`, `.gitmessage`
- `.husky/pre-commit`, `.husky/commit-msg`, `lint-staged.config.mjs`, `.markdown-link-check.json`
- `package.json` (add the husky `prepare` script + the relevant devDependencies)

#### Agent prompt

```
You are a senior TypeScript tooling engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. pnpm monorepo, Node 24,
TypeScript 5.9 strict, ESLint flat config, Prettier, Conventional Commits.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.2 of 7 (MIDDLE)

PRECONDITIONS
- Task 0.1 done: pnpm workspace + tsconfig.base.json exist; `pnpm install` and `pnpm typecheck` pass.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "2. Global Conventions" (lint/format/pre-commit/commits rows).
- Sibling files (copy & adapt): ~/Documents/MyApps/bymax-one/nest-logger-example/
  {eslint.config.mjs, .prettierrc.mjs, .prettierignore, commitlint.config.mjs, .gitmessage, lint-staged.config.mjs,
   .husky/pre-commit, .husky/commit-msg, .markdown-link-check.json}.

TASK
Install and configure the lint/format/commit governance toolchain so style + Conventional Commits are enforced.

DELIVERABLES
1. `eslint.config.mjs` — flat config as in the acceptance criteria.
2. `.prettierrc.mjs` + `.prettierignore`.
3. `commitlint.config.mjs` (extends config-conventional) + `.gitmessage`.
4. `.husky/pre-commit` (lint-staged) + `.husky/commit-msg` (commitlint) + `lint-staged.config.mjs`; add a
   `"prepare": "husky"` script to package.json.
5. `.markdown-link-check.json`.
6. Add the devDependencies (eslint, @eslint/js, typescript-eslint, eslint-config-prettier, eslint-plugin-* as the
   sibling uses, prettier, husky, lint-staged, @commitlint/{cli,config-conventional}).

Constraints:
- `pnpm lint` must run with `--max-warnings 0`. English-only, timeless comments. No suppression comments.
- Use `pnpm install --no-frozen-lockfile` after editing package.json, then commit the updated lockfile.

Verification:
- `pnpm lint` — expected: exits 0 (no files yet, but config loads cleanly).
- `pnpm format:check` — expected: exits 0.
- `echo "bad message" | pnpm exec commitlint` — expected: non-zero (rejects non-conventional).

Completion Protocol: set 0.2 ✅ (block + index), tick criteria, header Progress `2 / 7`, update the P0 row in
DEVELOPMENT_PLAN to `2 / 7`, append `- 0.2 ✅ <date> — lint/format/commit governance`, commit
`chore(tooling): eslint + prettier + commitlint + husky` (no Co-Authored-By).
```

---

### Task 0.3 — Mandatory repo & community-health files

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: S
- **Depends on**: 0.1

#### Description

Add every file a public `@bymax-one/*` reference repo must carry so the project is legally clear, contributable, and
ready to be made public.

#### Acceptance criteria

- [x] `LICENSE` (MIT © Bymax One), `CHANGELOG.md` (Keep a Changelog, `## [Unreleased]`), `SECURITY.md` (report → email,
      not a public issue), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 by reference link).
- [x] `CLAUDE.md` + `AGENTS.md` (repo invariants for AI agents — link to OVERVIEW/DEVELOPMENT_PLAN; the run/test/gate
      cheat-sheet; **no phase/task references**).
- [x] `README.md` with the centered badge header (CI, coverage, mutation, license, TS-strict, Node, NestJS, Next,
      React, Tailwind, Prisma), a one-line tagline, a nav-link row, `## Overview`, `## Quick start`, an architecture
      diagram, a `## Documentation` table linking the `docs/*.md`, and `## License`.
- [x] `pnpm exec markdown-link-check` (or the CI step) reports no broken links.

#### Files to create / modify

- `LICENSE`, `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CLAUDE.md`, `AGENTS.md`

#### Agent prompt

```
You are a senior developer-experience engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification (NestJS 11 email+OTP
notification lib). MIT, going public, built end-to-end by autonomous agents.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.3 of 7 (MIDDLE)

PRECONDITIONS
- Task 0.1 done (workspace exists). docs/OVERVIEW.md and docs/DEVELOPMENT_PLAN.md exist.

REQUIRED READING (only these — do not load more):
- docs/OVERVIEW.md § "1. Purpose", § "20/21 License/Status" (voice + status), § "5 Repository Layout" (doc-set).
- The README badge house-style: vault [[Bymax-Lib-Standards/README-Badges]]; and the sibling
  ~/Documents/MyApps/bymax-one/nest-logger-example/README.md (header + Documentation table) and its
  {SECURITY.md? CONTRIBUTING.md?} — note: the logger example LACKS SECURITY/CONTRIBUTING/CODE_OF_CONDUCT, so author
  those from the nest-auth lib (~/Documents/MyApps/bymax-one/nest-auth/{SECURITY.md,CONTRIBUTING.md,CODE_OF_CONDUCT.md})
  as the template, adapted to an example app.

TASK
Author every mandatory repo + community-health file for a public reference app.

DELIVERABLES
1. `LICENSE` — MIT, "© Bymax One".
2. `README.md` — badge header + tagline + nav links + Overview + Quick start (clone → build sibling lib → infra:up →
   dev) + an ASCII architecture diagram (mirror OVERVIEW §3) + a Documentation table linking docs/*.md + License.
3. `CHANGELOG.md` — Keep-a-Changelog with `## [Unreleased]`.
4. `SECURITY.md` — supported versions + private report channel (email), not public issues.
5. `CONTRIBUTING.md` — Conventional Commits, the gate commands, link to OVERVIEW §16/§20.
6. `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 (by reference link + contact).
7. `CLAUDE.md` + `AGENTS.md` — repo invariants for agents: the stack, the run/test/gate cheat-sheet, the memory-safe
   test rule, the design-system-verbatim rule, links to OVERVIEW/DEVELOPMENT_PLAN. NO phase/task references.

Constraints:
- English-only, timeless. No phase/task/plan-stage references in any of these files (they are committed docs-as-config).
- Badges may point at the (not-yet-green) CI — that is expected pre-implementation.

Verification:
- All 8 files exist.
- `npx markdown-link-check README.md --config .markdown-link-check.json` — expected: no dead links (ignore the
  not-yet-existing badge endpoints per the config).
- `grep -riE "phase [0-9]|task [0-9]" CLAUDE.md AGENTS.md` — expected: no matches.

Completion Protocol: set 0.3 ✅ (block + index), tick criteria, header Progress `3 / 7`, update the P0 row in
DEVELOPMENT_PLAN, append `- 0.3 ✅ <date> — repo & community-health files`, commit
`docs(repo): add license, readme, security, contributing, agent files` (no Co-Authored-By).
```

---

### Task 0.4 — GitHub config & Copilot review

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.1

#### Description

Add the GitHub repository configuration (issue/PR templates, CODEOWNERS, dependency automation) and the four GitHub
Copilot code-review files customized for this stack, so every PR gets automated review during the agent build loop.

#### Acceptance criteria

- [x] `.github/ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml,config.yml}` (config links security reports to email,
      not a public issue), `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`.
- [x] `.github/dependabot.yml` (npm + github-actions, weekly, PRs only) **and/or** `renovate.json` (match the sibling's
      choice — the examples use `renovate.json`; pin `@bymax-one/nest-notification`).
- [x] The four Copilot review files: `.github/copilot-instructions.md`, `.github/instructions/code.instructions.md`,
      `.github/instructions/tests.instructions.md`, `.github/agents/agent-code-reviewer.agent.md` — **customized for the
      notification stack** (NestJS 11 + Next 16; the 100%-coverage/Stryker bar; the never-log-codes + multi-tenant rules;
      the no-phase-refs rule; the design-system-verbatim rule).
- [x] The three `instructions/*.md` + `copilot-instructions.md` are each **< 4000 chars**; the `.agent.md` may exceed.
- [x] No phase/task references in any of these files; YAML is valid.

#### Files to create / modify

- `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`
- `.github/dependabot.yml` and/or `renovate.json`
- `.github/copilot-instructions.md`, `.github/instructions/code.instructions.md`,
  `.github/instructions/tests.instructions.md`, `.github/agents/agent-code-reviewer.agent.md`

#### Agent prompt

```
You are a senior DevEx / repository-configuration engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification, built by autonomous agents
whose PRs are reviewed by GitHub Copilot. NestJS 11 (apps/api) + Next.js 16 (apps/web); 100% coverage + Stryker ≥95 bar.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.4 of 7 (MIDDLE)

PRECONDITIONS
- Task 0.1 done (workspace exists).

REQUIRED READING (only these — do not load more):
- The gold source (only the example with these files): ~/Documents/MyApps/bymax-one/nest-logger-example/.github/
  {copilot-instructions.md, instructions/code.instructions.md, instructions/tests.instructions.md,
   agents/agent-code-reviewer.agent.md} + renovate.json — copy the structure, then RE-CUSTOMIZE every line for the
   notification domain (do not leave logger-specific rules like LOG_KEYS or two-tier persistence).
- docs/OVERVIEW.md § "13 Multi-Tenant Security" + § "6 Feature Coverage Matrix" (the rules the reviewer must enforce:
  never log OTP codes, sha256 keys, controller-maps-verify, 100% coverage, every export demonstrated).
- vault [[GitHub-Actions/Bymax-Conventions]] (issue templates + dependabot policy).

TASK
Author the GitHub repo config + the 4 Copilot review files, customized for this stack.

DELIVERABLES
1. Issue templates (bug_report.yml, feature_request.yml) + config.yml (security → email link, not public issue).
2. PULL_REQUEST_TEMPLATE.md (checklist: gates green, no suppression comments, matrix row added if a feature, dashboard
   updated).
3. CODEOWNERS (owner = the maintainer / @bymaxone).
4. renovate.json (and/or dependabot.yml) pinning @bymax-one/nest-notification, grouping docker + github-actions.
5. The 4 Copilot files, re-customized: agent-code-reviewer.agent.md with a Blockers checklist that includes — OTP code
   logged anywhere; recipient PII unmasked in audit; verify mapped in the lib instead of the controller;
   exactOptionalPropertyTypes / noUncheckedIndexedAccess violations; library `.` (server) import in apps/web; suppression
   comments; a public export left undemonstrated; a Phase/task reference left in a comment; a finding surviving Stryker.

Constraints:
- Each of copilot-instructions.md + the 2 instructions/*.md < 4000 chars. English-only, timeless — NO phase/task
  references (these are docs-as-config). Valid YAML front-matter on the .agent.md (name, description, tools, user-invocable).

Verification:
- `find .github -type f` lists all 9 files.
- `for f in .github/copilot-instructions.md .github/instructions/*.md; do wc -c "$f"; done` — each < 4000.
- `grep -riE "phase [0-9]|task [0-9]" .github/` — expected: no matches.

Completion Protocol: set 0.4 ✅ (block + index), tick criteria, header Progress `4 / 7`, update the P0 row in
DEVELOPMENT_PLAN, append `- 0.4 ✅ <date> — github config + copilot review`, commit
`chore(github): issue/PR templates, CODEOWNERS, renovate, copilot review config` (no Co-Authored-By).
```

---

### Task 0.5 — Core CI workflow + audit-script stubs

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.1, 0.2

#### Description

Author `ci.yml` — the pipeline that gates every future PR — plus the export-usage / error-code audit script stubs that
pass trivially on the empty `apps/` and grow with the codebase.

#### Acceptance criteria

- [x] `.github/workflows/ci.yml` triggers on PR + push to `main`/`next`, with `install` → `lint` → `typecheck` →
      `unit` (placeholder, no-op until apps exist) → `export-usage-check` (runs both audit scripts) → `dependency-review`
      (PR only) jobs; least-privilege `permissions`, `concurrency` cancel-in-progress, pinned `actions/*` + `pnpm/action-setup`
  - `setup-node` (Node 24, pnpm before node), `--frozen-lockfile`, `timeout-minutes` per job. Job names match Appendix D.
- [x] `scripts/audit-library-exports.mjs` — dependency-free Node ESM that parses the linked lib's
      `dist/{server,shared,react}/index.d.ts`, word-boundary-searches `apps/**`, exits 0 when all referenced (or
      allow-listed), 1 when an export is unused, 2 on infra error; reads `.audit-ignore.json`. On the empty tree it exits 0
      (no apps yet) with an informational note.
- [x] `scripts/audit-error-codes.mjs` — asserts every `NOTIFICATION_ERROR_CODES` key is referenced in `apps/web`; exits
      0 on the empty tree.
- [x] `.audit-ignore.json` present (`{ "ignored": [] }`).
- [x] `pnpm audit:exports` and `pnpm audit:error-codes` exit 0 locally; `ci.yml` is valid (parses) and would run green.

#### Files to create / modify

- `.github/workflows/ci.yml`
- `scripts/audit-library-exports.mjs`, `scripts/audit-error-codes.mjs`, `.audit-ignore.json`
- `package.json` (wire `audit:exports` / `audit:error-codes` scripts)

#### Agent prompt

```
You are a senior CI/CD engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification, agent-built; every PR must
pass a strong CI before merge. pnpm monorepo, Node 24, apps/api + apps/web added later.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.5 of 7 (MIDDLE)

PRECONDITIONS
- Tasks 0.1 + 0.2 done: workspace installs/typechecks/lints; root scripts exist.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix C Quality Gates" + § "Appendix D CI/CD Workflow Matrix" (job names + gates).
- The gold source: ~/Documents/MyApps/bymax-one/nest-logger-example/.github/workflows/ci.yml (job graph + hardening) and
  scripts/{audit-library-exports.mjs, audit-log-keys.mjs} + .audit-ignore.json — copy the export-audit script and adapt
  it to 3 subpaths (server/shared/react) and the package name @bymax-one/nest-notification; model the error-code audit
  on the log-key audit (assert every NOTIFICATION_ERROR_CODES key appears in apps/web).
- docs/OVERVIEW.md § "6 Feature Coverage Matrix" (the Coverage rule the export audit enforces).

TASK
Author ci.yml + the two audit-script stubs so the empty workspace passes and the gate grows with the code.

DELIVERABLES
1. `.github/workflows/ci.yml` — jobs install/lint/typecheck/unit(placeholder)/export-usage-check/dependency-review,
   with the sibling's hardening (top-level `permissions: contents: read`, `concurrency: ci-${{ github.ref }}` cancel-in-
   progress, checkout@v5, pnpm/action-setup@v4 pinned, setup-node@v5 node 24 cache pnpm — pnpm BEFORE node,
   --frozen-lockfile, timeout-minutes). `unit` may run `echo "no apps yet"` until P3+. dependency-review runs on PRs only.
2. `scripts/audit-library-exports.mjs` — the adapted 3-subpath export-usage audit (exit 0/1/2; reads .audit-ignore.json;
   prints a clear "0 apps/ files yet" note and exits 0 when apps/ is empty or absent).
3. `scripts/audit-error-codes.mjs` — the error-code-localization audit (exit 0 on empty tree).
4. `.audit-ignore.json` = `{ "ignored": [] }`; wire `audit:exports`/`audit:error-codes` in package.json.

Constraints:
- Scripts are dependency-free Node ESM (`node:fs`, `node:path` only). English-only. Job names are contractual — match
  Appendix D exactly. Untrusted `${{ github.* }}` only via `env:`.

Verification:
- `node scripts/audit-library-exports.mjs` — expected: exit 0 with a "no apps/ yet" note.
- `node scripts/audit-error-codes.mjs` — expected: exit 0.
- `pnpm dlx @action-validator/cli .github/workflows/ci.yml` (or a YAML parse) — expected: valid.

Completion Protocol: set 0.5 ✅ (block + index), tick criteria, header Progress `5 / 7`, update the P0 row in
DEVELOPMENT_PLAN, append `- 0.5 ✅ <date> — core CI + audit script stubs`, commit
`ci: core pipeline (lint/typecheck/audits/dependency-review) + audit scripts` (no Co-Authored-By).
```

---

### Task 0.6 — Security & supply-chain workflows

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.5

#### Description

Add the go-public security hardening the sibling examples lack: CodeQL static analysis, OpenSSF Scorecard, and a secret
scan — wired and running (informational) so the repo is safe to make public.

#### Acceptance criteria

- [ ] `.github/workflows/codeql.yml` — `javascript-typescript`, `security-extended` query set, on PR + push `main` +
      weekly cron; `permissions: security-events: write` (only that job); SARIF → Security tab.
- [ ] `.github/workflows/scorecard.yml` — OpenSSF Scorecard on push `main` + weekly cron + dispatch; publishes results;
      `id-token: write` + `security-events: write` scoped to the job.
- [ ] A secret scan (gitleaks action) wired — either a `secret-scan` job in `ci.yml` or a small `.github/workflows/secret-scan.yml`
      — running on PR + push and failing on a detected secret.
- [ ] All three run green/informational on a PR/push (no real secrets exist — only Mailpit/test fixtures later).

#### Files to create / modify

- `.github/workflows/codeql.yml`, `.github/workflows/scorecard.yml`, `.github/workflows/secret-scan.yml` (or a job in `ci.yml`)

#### Agent prompt

```
You are a senior application-security / supply-chain engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. The repo is PRIVATE now and
will be made PUBLIC; it must carry the canonical published-@bymax-one/* security workflows before going public.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.6 of 7 (MIDDLE)

PRECONDITIONS
- Task 0.5 done: ci.yml exists with least-privilege permissions and pinned actions.

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix D CI/CD Workflow Matrix" (codeql/scorecard rows) + § "Appendix E Go-Public Checklist".
- vault [[GitHub-Actions/Bymax-Conventions]] (the codeql.yml + scorecard.yml standard + least-privilege principles) and
  [[Bymax-Lib-Standards]] (why CONTRIBUTING/CODE_OF_CONDUCT support Scorecard).
- The current official setup: re-verify the github/codeql-action and ossf/scorecard-action usage via context7/WebSearch
  (these actions move; pin the current major).

TASK
Add CodeQL, OpenSSF Scorecard, and a secret scan as go-public security gates.

DELIVERABLES
1. `.github/workflows/codeql.yml` — language `javascript-typescript`, `queries: security-extended`, triggers PR + push
   main + weekly cron; job-scoped `permissions: { actions: read, contents: read, security-events: write }`; pinned
   github/codeql-action steps; timeout.
2. `.github/workflows/scorecard.yml` — ossf/scorecard-action on push main + weekly cron + dispatch; `publish_results: true`;
   job-scoped `permissions: { security-events: write, id-token: write, contents: read }`; upload SARIF.
3. A secret scan: `.github/workflows/secret-scan.yml` (gitleaks/gitleaks-action) on PR + push, failing on detection.

Constraints:
- Least-privilege: top-level `permissions: contents: read`; widen only per job. Pin all action versions. Add
  `timeout-minutes`. English-only, no phase/task references.

Verification:
- `for f in codeql scorecard secret-scan; do echo $f; done` and `ls .github/workflows/{codeql,scorecard,secret-scan}.yml`
  — expected: all present.
- YAML parses (action-validator or a yaml lint).
- `gitleaks detect --no-git -v` locally (if gitleaks installed) — expected: no leaks.

Completion Protocol: set 0.6 ✅ (block + index), tick criteria, header Progress `6 / 7`, update the P0 row in
DEVELOPMENT_PLAN, append `- 0.6 ✅ <date> — codeql + scorecard + secret-scan`, commit
`ci(security): add codeql, scorecard, and secret-scan workflows` (no Co-Authored-By).
```

---

### Task 0.7 — Mutation/release workflow skeletons + Dockerfiles

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: M
- **Depends on**: 0.5

#### Description

Add the remaining workflow skeletons (mutation PR + nightly, release on tag) and the multi-stage Dockerfile skeletons,
so the full pipeline shape exists from day one and is filled in by later phases (P13 mutation, P14 release).

#### Acceptance criteria

- [ ] `.github/workflows/mutation.yml` — PR-triggered, `dorny/paths-filter` per workspace, runs `stryker run --incremental`
      per changed app, caches the incremental file; no-ops cleanly while `apps/` is empty (guards on the path filter).
- [ ] `.github/workflows/mutation-nightly.yml` — Monday 03:00 UTC + dispatch, `stryker run --force`; opens a
      `mutation-drift`-labelled issue on failure (`issues: write`, idempotent).
- [ ] `.github/workflows/release.yml` — on tag `v*`: validates tag ↔ version, OIDC (`id-token: write`, `packages: write`),
      builds + pushes GHCR images `…-api` / `…-web`, then a `contents: write` job prepends a row to `docs/RELEASES.md`;
      untrusted refs via `env:`. It **validates without publishing** when run pre-release (or is dispatch-guarded).
- [ ] `apps/api/Dockerfile` + `apps/web/Dockerfile` — multi-stage skeletons (build from repo root) that are coherent but
      not yet runnable (apps don't exist); `.dockerignore` present.
- [ ] All workflows parse; `release.yml`'s tag↔version check passes on a dry run.

#### Files to create / modify

- `.github/workflows/mutation.yml`, `.github/workflows/mutation-nightly.yml`, `.github/workflows/release.yml`
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`, `docs/RELEASES.md` (seed table)

#### Agent prompt

```
You are a senior release-engineering / CI engineer working on the nest-notification-example project.

PROJECT: nest-notification-example — public reference app for @bymax-one/nest-notification. Two container images
(apps/api, apps/web) shipped to GHCR via OIDC on a v* tag; Stryker mutation gate per PR + nightly.

CURRENT PHASE: 0 (Foundation, Tooling & CI Skeleton) — Task 0.7 of 7 (LAST)

PRECONDITIONS
- Task 0.5 done: ci.yml + audit scripts exist. apps/ do not exist yet (filled in P3/P8).

REQUIRED READING (only these — do not load more):
- docs/DEVELOPMENT_PLAN.md § "Appendix D CI/CD Workflow Matrix" (mutation/release rows) + § "Appendix C" (mutation bar).
- The gold source: ~/Documents/MyApps/bymax-one/nest-logger-example/.github/workflows/{mutation.yml,mutation-nightly.yml,
  release.yml} + apps/{api,web}/Dockerfile + docs/RELEASES.md — copy & adapt (package name, image names
  ghcr.io/bymaxone/nest-notification-example-{api,web}, NEXT_PUBLIC_* build args = NEXT_PUBLIC_API_URL).
- vault [[GitHub-Actions/Bymax-Conventions]] (OIDC release + script-injection guard).

TASK
Author the mutation + release workflow skeletons and the Dockerfile skeletons so the full pipeline shape exists.

DELIVERABLES
1. mutation.yml (PR, paths-filter, per-app `stryker run --incremental`, cache) — guarded so it no-ops while apps/ empty.
2. mutation-nightly.yml (Monday cron + dispatch, `--force`, opens a drift issue on failure).
3. release.yml (tag v*, OIDC, GHCR `…-api`/`…-web`, `docker manifest inspect` idempotency, metadata-action semver tags,
   then a contents:write job prepending a RELEASES.md row; untrusted `${{ github.ref_name }}` via `env: TAG`).
4. apps/api/Dockerfile + apps/web/Dockerfile (multi-stage, repo-root context) + .dockerignore.
5. docs/RELEASES.md — branch→version table + a "Tested-version log" table with a `_pending_ / _pre-release_` seed row.

Constraints:
- Least-privilege; pin actions; timeouts. Untrusted refs ONLY via env. English-only, no phase/task references.
- Dockerfiles are skeletons (apps not built yet) but structurally correct.

Verification:
- `ls .github/workflows/{mutation,mutation-nightly,release}.yml apps/api/Dockerfile apps/web/Dockerfile .dockerignore docs/RELEASES.md`
  — expected: all present.
- YAML parses for the 3 workflows.
- The release tag↔version guard logic is present (grep for the version-compare step).

Completion Protocol (this is the LAST task — run the PER-TASK protocol, THEN the PER-PHASE protocol):
PER-TASK: set 0.7 ✅ (block + index), tick criteria, header Progress `7 / 7`, update the P0 row Progress to `7 / 7` in
DEVELOPMENT_PLAN, append `- 0.7 ✅ <date> — mutation/release skeletons + Dockerfiles`, commit
`ci: mutation + release workflow skeletons + Dockerfiles` (no Co-Authored-By).
PER-PHASE (see docs/tasks/README.md "Per-phase Completion Protocol"): once the PR is merged and CI is green, set the P0
**Status to ✅** and Progress `7 / 7` in docs/DEVELOPMENT_PLAN.md, advance **Active phase** to P1, recompute
**Overall progress** to `1 / 15 phases (7%)`, set this file's header Status to ✅, and commit `docs(plan): P0 complete`.
```

---

## Phase Completion Protocol

When **Task 0.7** is `✅` and every other task is `✅`:

1. Confirm all 7 tasks are `✅` and the P0 **Definition of Done** in [`DEVELOPMENT_PLAN.md § P0`](../DEVELOPMENT_PLAN.md#phase-0--foundation-tooling--ci-skeleton)
   is met: empty workspace installs/typechecks/lints/formats; `ci.yml` green on a PR; `codeql` + `scorecard` +
   secret-scan run; `release.yml` validates without publishing; all go-public files present; Copilot config present.
2. Ensure the phase PR is **merged** to `main` with **CI green** (all required checks).
3. In [`DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the **P0 Status** to `✅`, **Progress** `7 / 7`, **Last
   updated** today; set **Active phase** to `P1`; recompute **Overall progress** to `1 / 15 phases (7%)`.
4. Set this file's header **Status** to `✅` and **Progress** to `7 / 7 tasks`.
5. Commit `docs(plan): P0 complete` (no `Co-Authored-By`).

If any DoD bullet is unmet or CI is red, set P0 to `🟡 Partial`, not `✅`.

---

## Completion log

> Append-only. One line per completed task: `- <id> ✅ YYYY-MM-DD — <summary>`.

- 0.1 ✅ 2026-06-23 — pnpm workspace + TS foundation
- 0.2 ✅ 2026-06-23 — lint/format/commit governance
- 0.3 ✅ 2026-06-23 — repo & community-health files
- 0.4 ✅ 2026-06-23 — github config + copilot review
- 0.5 ✅ 2026-06-23 — core CI + audit script stubs
