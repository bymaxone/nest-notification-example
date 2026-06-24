# Stryker — Baseline (pre-hardening)

First mutation measurement of each workspace, recorded before its hardening pass.
Source config: [`apps/api/stryker.config.json`](../../apps/api/stryker.config.json),
[`apps/web/stryker.config.json`](../../apps/web/stryker.config.json).

See [Phase 13 tasks](../tasks/phase-13-mutation.md) and
[DEVELOPMENT_PLAN Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates) for the threshold rationale.

---

## apps/api — 2026-06-24 (pre-hardening)

| Metric          | Value               |
| --------------- | ------------------- |
| Mutation score  | 79.26%              |
| Break threshold | 100                 |
| Exit code       | 1 (below threshold) |

The api surface (Prisma audit, ioredis OTP, MJML rendering, the dual-source audit bus) started at 79.26%.
Hardening killed every viable survivor and documented the handful of provable equivalents, landing the workspace
at **100.00%** — see [HISTORY.md](./HISTORY.md) and the final table below.

---

## apps/web — 2026-06-24 (pre-hardening of `components/**`)

Measured after `lib/**` was already driven to ~100% (its hardening landed first), with the
component layer still unhardened.

| Metric          | Value               |
| --------------- | ------------------- |
| Mutation score  | 84.29%              |
| Killed          | 1324                |
| Survived        | 247                 |
| Timeout         | 1                   |
| No coverage     | 0                   |
| Ignored         | 328                 |
| Break threshold | 95                  |
| Exit code       | 1 (below threshold) |

### Component-layer survivors by file (pre-hardening, descending)

| File                             | Survived | Dominant mutators                                     |
| -------------------------------- | -------- | ----------------------------------------------------- |
| `explorer/query-bar.tsx`         | 29       | StringLiteral, ConditionalExpression, BooleanLiteral  |
| `explorer/facet-rail.tsx`        | 28       | StringLiteral, ObjectLiteral, ConditionalExpression   |
| `otp/otp-verify-panel.tsx`       | 27       | ObjectLiteral, StringLiteral, BooleanLiteral          |
| `explorer/explorer-content.tsx`  | 20       | StringLiteral, ConditionalExpression, LogicalOperator |
| `explorer/detail-drawer.tsx`     | 17       | ConditionalExpression, ObjectLiteral, Regex           |
| `trigger/trigger-card.tsx`       | 17       | StringLiteral, ObjectLiteral, BlockStatement          |
| `charts/delivery-rate-line.tsx`  | 13       | BooleanLiteral, ObjectLiteral, StringLiteral          |
| `explorer/log-table.tsx`         | 13       | ObjectLiteral, StringLiteral, ArrowFunction           |
| `charts/chart-card.tsx`          | 10       | ConditionalExpression, StringLiteral                  |
| `charts/stat-tile.tsx`           | 9        | StringLiteral, ConditionalExpression, ObjectLiteral   |
| `charts/top-bar.tsx`             | 9        | StringLiteral, MethodExpression, ArithmeticOperator   |
| _(long tail — 16 further files)_ | 55       | StringLiteral, ConditionalExpression, BooleanLiteral  |

---

## Final (post-hardening) — 2026-06-24

| Workspace | Score   | Killed | Survived | Timeout | Ignored | Break | Exit |
| --------- | ------- | ------ | -------- | ------- | ------- | ----- | ---- |
| apps/api  | 100.00% | 504    | 0        | 0       | 15      | 100   | 0    |
| apps/web  | 99.42%  | 1539   | 9        | 1       | 351     | 95    | 0    |

`lib/**` finished at **99.86%** (701 killed, 1 documented-equivalent residual); `components/**` carries the
remaining residuals. All non-ignored survivors are **provable equivalents** — see the rationale of each in
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#equivalent-mutants-documented-accepted). The `Ignored` columns are
the co-located `// Stryker disable` directives plus the `ignoreStatic` mutants (web only); `apps/api` never sets
`ignoreStatic`.
