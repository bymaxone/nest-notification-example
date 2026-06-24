# Stryker — Run History

Append-only. Newest run on top. One row per `pnpm mutation` (or `mutation:incremental`) run that produced a
recorded score.

See [BASELINE.md](./BASELINE.md) for the pre-hardening snapshot and
[DEVELOPMENT_PLAN Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates) for the threshold rationale.

| Date       | Workspace | Score   | Killed | Survived | Timeout | No-cov | Ignored | Note                                                  |
| ---------- | --------- | ------- | ------ | -------- | ------- | ------ | ------- | ----------------------------------------------------- |
| 2026-06-24 | apps/web  | 99.42%  | 1539   | 9        | 1       | 0      | 351     | final green — full `--force` run, meets break: 95     |
| 2026-06-24 | apps/api  | 100.00% | 504    | 0        | 0       | 0      | 15      | final green — hardening complete, meets break: 100    |
| 2026-06-24 | apps/web  | 84.29%  | 1324   | 247      | 1       | 0      | 328     | baseline — `lib/**` hardened, `components/**` not yet |
| 2026-06-24 | apps/api  | 79.26%  | —      | —        | —       | —      | —       | baseline (pre-hardening)                              |
