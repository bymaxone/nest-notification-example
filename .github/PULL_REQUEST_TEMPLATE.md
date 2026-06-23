## Summary

<!-- What does this PR change, and why? Link the relevant docs section. -->

## Type of change

- [ ] New library feature demonstrated (adds a Feature Coverage Matrix row + a browser-reachable surface)
- [ ] Fix / improvement to an existing surface
- [ ] Docs / tooling / CI only

## Checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm format:check` are green.
- [ ] `pnpm test:cov` passes at 100% (both apps, where applicable).
- [ ] `pnpm audit:exports && pnpm audit:error-codes` pass.
- [ ] No suppression comments (`@ts-ignore`, `@ts-expect-error`, `eslint-disable*`) and no `any`.
- [ ] No OTP code or unmasked recipient is logged, returned, or written to an audit row.
- [ ] If a library feature was added: a Feature Coverage Matrix row **and** a browser-reachable way to exercise it.
- [ ] The dashboards in `docs/` are updated (status, progress, completion log).
- [ ] Conventional Commit messages; **no `Co-Authored-By` trailer**.
