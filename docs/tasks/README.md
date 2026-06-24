# Task Files — Index & Conventions

> Layer 3 of the `spec → roadmap → phase-tasks` workflow. One file per phase, each carrying JIRA-style task tables and
> self-contained **agent execution prompts**. Source roadmap: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) ·
> Source spec: [`../OVERVIEW.md`](../OVERVIEW.md). Format follows the `rust-auth` gold reference
> (`bymax-one/rust-auth/docs/tasks/`) and the vault [[Example-App-Standard]].

## Phase files

| Phase | File                                | Scope                                                                               | Status |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| P0    | `phase-00-foundation-ci.md`         | pnpm workspace, toolchain, governance files, **full CI/CD + go-public scaffolding** | ✅     |
| P1    | `phase-01-local-stack.md`           | docker-compose (postgres/redis/mailpit) + Zod env schema                            | ✅     |
| P2    | `phase-02-library-consumption.md`   | `file:` link the lib, peers, subpath probe, export audit                            | ✅     |
| P3    | `phase-03-api-skeleton.md`          | NestJS bootstrap, `/health`, exception filter, Redis/Prisma modules                 | ✅     |
| P4    | `phase-04-notification-wiring.md`   | `forRootAsync`, providers/renderer, audit store + interceptor                       | ✅     |
| P5    | `phase-05-otp-email-controllers.md` | `/otp/*`, `/email/*`, `/dispatch`, `/channels`, `/debug/key`                        | ✅     |
| P6    | `phase-06-audit-read-api.md`        | `/audit/{logs,stream,aggregate}` (keyset + SSE)                                     | ✅     |
| P7    | `phase-07-roadmap-rejection.md`     | `/admin/try-configure-{sms,push,async-useclass}`                                    | ✅     |
| P8    | `phase-08-web-skeleton.md`          | Next.js shell + **verbatim** design system + global controls                        | ✅     |
| P9    | `phase-09-console-core.md`          | Overview · Trigger Center · Audit Explorer (+ live tail)                            | ✅     |
| P10   | `phase-10-otp-providers-panels.md`  | OTP-verify · provider matrix · email preview · roadmap · settings                   | ✅     |
| P11   | `phase-11-auth-seam.md`             | `NotificationAuthEmailProvider` + the nest-auth journey                             | ✅     |
| P12   | `phase-12-testing.md`               | 100% coverage (Jest api + Vitest web) + Playwright                                  | ✅     |
| P13   | `phase-13-mutation.md`              | Stryker ≥ 95 → 100; `docs/stryker/*`                                                | 📋     |
| P14   | `phase-14-docs-release.md`          | all `docs/*.md`, public-readiness, `v0.1.0` release                                 | 📋     |

All 15 phase files are scaffolded. Execute them **one phase at a time** (per [`../DEVELOPMENT_PLAN.md` §3](../DEVELOPMENT_PLAN.md#3-autonomous-execution-model)) — a phase starts only after the previous one merges green.

## Status legend (matches the roadmap)

`📋 ToDo` · `🔄 In Progress` · `👀 Review` · `✅ Done` · `⛔ Blocked` · `🟡 Partial`

## Token economy — executing a single task

> Phase files are intentionally large; **do not read a whole file to execute one task**. Every `### Task N.n` block is
> **fully self-contained** — its `#### Agent prompt` carries the project context, preconditions, a **bounded**
> `REQUIRED READING` list, the deliverables, the verification commands, and the completion protocol. To execute task
> `N.n`, an agent should:
>
> 1. **Jump straight to its block.** Open only the `## Task index` (to confirm `N.n`'s `Depends on` are `✅`) and the
>    single `### Task N.n — …` heading — use `grep -n "### Task N.n"` then `Read` with `offset`/`limit` (or read just
>    that anchor). **Never load the entire phase file into context.**
> 2. **Read only what the prompt lists.** The prompt's `REQUIRED READING (only these — do not load more)` is the
>    complete external-context budget. Do not open sibling tasks, other phase files, or the full spec.
> 3. **Self-contained = no "see above".** The prompt is droppable into a fresh conversation; it never depends on the
>    rest of the file or chat history.
>
> The files are authored to make this cheap: stable `### Task N.n` anchors, a compact `## Task index`, and bounded
> reading lists. Keep them that way when adding tasks.

## Task-file anatomy (each `phase-NN-*.md`)

1. **Header** — `# Phase N — <title>` then a blockquote: `Status · Progress (n / N tasks) · Last updated` + back-links
   to `DEVELOPMENT_PLAN.md § PN` and `OVERVIEW.md`.
2. **`## Context`** — what the previous phase produced, what this phase fills in, the observable end-state.
3. **`## Rules-of-phase`** — numbered, only the conventions that bite specifically here.
4. **`## Reference docs`** — exact `OVERVIEW.md §`, roadmap §, sibling files to read, and `/bymax-workflow:standards`.
5. **`## Task index`** — `| ID | Task | Status | Priority | Size | Depends on |`. IDs are `<phase>.<n>` (e.g. `0.3`);
   Priority `P0|P1|P2`; Size `S|M|L`; Depends-on = task IDs or `—`.
6. **`## Tasks`** — one `### Task N.n — <title>` per row: metadata bullets → `#### Description` →
   `#### Acceptance criteria` (checkboxes) → `#### Files to create / modify` → `#### Agent prompt` (a **4-backtick
   fence** with Role · PROJECT · CURRENT PHASE · PRECONDITIONS · REQUIRED READING (bounded) · TASK · DELIVERABLES ·
   Constraints · Verification (exact commands + expected output) · Completion Protocol).
7. **`## Phase Completion Protocol`** — the closeout the agent runs when the **last** task of the phase is done.
8. **`## Completion log`** — append-only, one line per finished task.

## Per-task Completion Protocol (the agent runs this after EVERY task)

> Keeping the dashboards honest is non-negotiable — these updates are how progress is tracked.

1. Set the task's **Status** emoji to `✅` in **both** its `### Task` block and the `## Task index` row.
2. Tick every satisfied `#### Acceptance criteria` checkbox.
3. Increment the file-header **Progress** counter (`n / N tasks`) and update **Last updated**.
4. Update the matching phase row's **Progress** cell in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) Phase
   dashboard (e.g. `2 / 7`) and its **Last updated**.
5. Append a line to this file's **`## Completion log`**: `- <id> ✅ <YYYY-MM-DD> — <one-line summary>`.
6. Commit the change with the task's code (`<type>(scope): <subject>`, **no `Co-Authored-By`**).

**Never mark a task `✅` while any acceptance bullet is unmet or its verification command fails — leave it `🔄`.**

## Per-phase Completion Protocol (the agent runs this when the phase's LAST task is `✅`)

1. Confirm **every** task in the file is `✅` and the phase's roadmap **Definition of Done** bullets are all met.
2. Ensure the phase's PR is **merged** and **CI is green** on `main` (all required checks).
3. In [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md): set the phase's **Status** to `✅`, **Progress** to `N / N`,
   and **Last updated**; advance **Active phase** to the next phase; recompute **Overall progress** (`X / 15 phases`, %).
4. Set this file's header **Status** to `✅` and **Progress** to `N / N tasks`.
5. Commit: `docs(plan): P<N> complete` (no `Co-Authored-By`).

**If a DoD bullet is unmet or CI is red, set the phase to `🟡 Partial`, not `✅`.**

## Execution rules (the three invariants)

- **One-in-progress-at-a-time** — exactly one phase `🔄` and one task `🔄` within it.
- **Never-start-until-deps-green** — a task starts only when every `Depends on` task is `✅`.
- **Never-mark-done-with-failing-verification** — `✅` requires the verification commands to pass.

See [`../DEVELOPMENT_PLAN.md` §3 Autonomous Execution Model](../DEVELOPMENT_PLAN.md#3-autonomous-execution-model) for
the full per-phase branch → PR → Copilot-review → merge loop.
