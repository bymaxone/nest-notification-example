# Stryker — Implementation Plan (path to the gate)

Target: `apps/api` `break: 100` (zero viable survivors); `apps/web` `break: 95` with `lib/**` held at ~100 and
`components/**` driven as high as achievable. Both workspaces meet their gate (api 100.00%, web 99.42%).

See [Phase 13 tasks](../tasks/phase-13-mutation.md) and
[DEVELOPMENT_PLAN Appendix C](../DEVELOPMENT_PLAN.md#appendix-c--quality-gates).

---

## Hardening order (apps/web `components/**`)

Worked file-by-file using `apps/web/reports/mutation/web.html` sorted by "Survived" descending. The repeatable kill
patterns that closed the component layer:

1. **URL-write assertions.** nuqs setters are throttled, so a `setQuery({...})` is observed via the
   `onUrlUpdate` spy: `onUrlUpdate.mock.calls.at(-1)[0].searchParams.get(key)`. This kills `ObjectLiteral`
   (`{ channel }` → `{}`) and the switch-`case` `ConditionalExpression` mutants by asserting the exact key/value
   each facet/pivot writes. A non-write no-op is asserted by `await settle()` past the throttle window, then
   `expect(onUrlUpdate).not.toHaveBeenCalled()`.
2. **Stateful `className` / `style` assertions.** `toHaveClass('text-destructive')`, the active-facet highlight
   (`text-brand-500` vs `text-white/65`), the connected-pulse, and inline `style.color` / `style.width` kill the
   decorative-string and conditional-class mutants that ARE observable in jsdom.
3. **Recharts prop probes.** Chart internals (`dot`, `isAnimationActive`, `allowDecimals`, `margin`, axis `tick`,
   grid `vertical`, `Cell` `fill`) do not render observably in jsdom, so `recharts` is mocked with prop-capturing
   stubs and the exact config asserted via `JSON.parse(node.dataset.props)`. This kills every `BooleanLiteral` /
   `ObjectLiteral` / `StringLiteral` chart-config mutant honestly, without burning the equivalence budget.
4. **Boundary + branch tests.** `EqualityOperator` (`<` vs `<=`) and `ConditionalExpression` mutants are killed by
   asserting both arms AND the exact boundary value (e.g. the prefetch threshold at remaining === 320; the 90%
   delivery-rate boundary).
5. **External-resync seam.** A sibling control that calls `setQuery` drives a real URL change so the
   focus-guarded sync effect (`if (!focused.current)`) is exercised both focused and not.
6. **Cross-component cache keys.** The shared `['settings-status', tenantId]` query key is proven by rendering
   `ConfigStatus` + `FrozenOptions` together and asserting one network read; the per-tenant `provider-matrix` key
   is proven by rendering two tenants and asserting each refetches.

---

## Stack gotchas

- **nuqs writes are throttled.** A synchronous `expect(spy).not.toHaveBeenCalled()` right after a key press passes
  even when the handler fired — assert the negative only after `setTimeout(…, 200)`, and assert the positive via
  `waitFor`.
- **`getAllByText` throws on no match** — a `StringLiteral` → `''` mutant that empties a label is killed by a
  plain `getByText('…')`, but only if the label text is unique.
- **shadcn `Badge`/`Button` `defaultVariants.variant: 'default'`** — mutating `'default'` → `''` resolves back to
  the default variant, producing identical classes. These are genuine equivalents (see residuals below); the
  sibling `'outline'` on the same line stays mutation-tested.
- **Recharts in jsdom** renders nothing useful at zero container width — mock it to assert chart configuration.
- **`ignoreStatic: true` (web only)** suppresses module-load-time mutants in the vendored design tokens / static
  series tables; `apps/api` keeps `ignoreStatic` OFF because its bar is `break: 100`.
- **Stryker `disable next-line` reads the leading comment of the block** above the mutated line; a directive buried
  below explanatory comment lines is not applied.

---

## Equivalent mutants (documented, accepted)

Each row has a co-located `// Stryker disable …` comment in source stating the same rationale. One row per directive.

| Workspace | File                                             | Mutator(s)                                            | Why equivalent                                                                                                        |
| --------- | ------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| apps/api  | `config/env.schema.ts` ~L103                     | StringLiteral                                         | The `(root)` issue-path fallback is unreachable from this flat single-field schema; no field-level rejection hits it  |
| apps/api  | `notification/notification.config.ts` ~L60       | Regex                                                 | The `^`/`$` anchors are redundant — `String.replace` over the whole token matches identically without them            |
| apps/api  | `notification/renderers/mjml.renderer.ts` ~L108  | ObjectLiteral                                         | `validationLevel: 'soft'` is already MJML's default; an emptied options object renders identically                    |
| apps/api  | `notification/renderers/mjml.renderer.ts` ~L119  | ConditionalExpression                                 | Storing `text: undefined` vs omitting the key is observationally identical downstream                                 |
| apps/api  | `audit/audit-event.bus.ts` ~L103                 | StringLiteral                                         | The `?? ''` only guards `null.toLowerCase()`; for any real provider name the fallback is never taken                  |
| apps/api  | `audit/audit-event.bus.ts` ~L185                 | ConditionalExpression, StringLiteral                  | An early-return fast path whose removed work is redone identically by the code below                                  |
| apps/api  | `audit/audit-read.service.ts` ~L98               | StringLiteral                                         | The Error is caught by the surrounding `catch` and remapped; its message text is never observable by callers          |
| apps/web  | `lib/filters.ts` ~L166                           | ArithmeticOperator                                    | The tick counter is a memo trigger only; `+1` vs `-1` recomputes the `Date.now()`-derived window equally              |
| apps/web  | `lib/filters.ts` ~L171                           | ArrayDeclaration                                      | Emptying the ticker effect deps only shifts WHEN teardown runs; a leaked interval can't change the compiled query     |
| apps/web  | `lib/trigger-api.ts` ~L57                        | Regex                                                 | The `^`/`$` anchors are redundant — `String.replace` evaluates the same with or without them                          |
| apps/web  | `lib/sse.ts` ~L49                                | ConditionalExpression, EqualityOperator               | The length guard is an optimization; the loop body is a no-op for an empty batch regardless                           |
| apps/web  | `lib/sse.ts` ~L118                               | ConditionalExpression                                 | Early-return optimization for the already-empty pending list — output identical either way                            |
| apps/web  | `lib/sse.ts` ~L148                               | ConditionalExpression                                 | Forcing the guard true is equivalent — with no pending rows the flush is a no-op                                      |
| apps/web  | `lib/sse.ts` ~L168                               | ArrayDeclaration                                      | The initial pending list is reset to `[]` by the effect before any push, so its initial contents are unobservable     |
| apps/web  | `lib/sse.ts` ~L174                               | BooleanLiteral                                        | The effect always sets `isFailed` (false on enable / true on terminal error), so the seed value is never read         |
| apps/web  | `lib/sse.ts` ~L202                               | ConditionalExpression, BlockStatement                 | Cancelling a pending frame here is belt-and-suspenders; the next subscription re-cancels identically                  |
| apps/web  | `lib/api/http.ts` ~L83                           | ConditionalExpression                                 | The `in`-narrowing is a TypeScript guard; the runtime branch taken is unchanged                                       |
| apps/web  | `lib/api/http.ts` ~L102                          | ConditionalExpression                                 | The `'message' in error` narrowing is required for typing; both arms reach the same fallback                          |
| apps/web  | `lib/api/http.ts` ~L111                          | ConditionalExpression                                 | Forcing this guard true is equivalent — a non-envelope value still yields the generic error                           |
| apps/web  | `lib/api/http.ts` ~L149                          | ArrowFunction                                         | A parse failure must yield a non-envelope value; `null` and `undefined` are handled identically                       |
| apps/web  | `lib/api/otp.ts` ~L86                            | ConditionalExpression                                 | Returning the raw `reason` vs null for an unknown code maps to the same generic outcome                               |
| apps/web  | `lib/api/otp.ts` ~L150                           | ArrowFunction                                         | A parse failure must yield a non-object value; `null` and `undefined` both fall to the error path                     |
| apps/web  | `lib/api/roadmap.ts` ~L28                        | ConditionalExpression, LogicalOperator                | The `in`-narrowing guard is required for typing; both arms reach the same result                                      |
| apps/web  | `lib/api/roadmap.ts` ~L44                        | ArrowFunction                                         | A parse failure must yield a non-object value; `null` and `undefined` are equivalent here                             |
| apps/web  | `components/otp/otp-verify-panel.tsx` ~L88       | ObjectLiteral, StringLiteral                          | A thrown issue has no wire code; the empty string localizes to the generic fallback and `retryAfterSeconds` is unread |
| apps/web  | `components/otp/otp-verify-panel.tsx` ~L178      | StringLiteral                                         | A thrown verify has no code; `''` and any unknown sentinel both localize to the generic fallback message              |
| apps/web  | `components/otp/otp-verify-panel.tsx` ~L195      | StringLiteral                                         | A thrown consume has no code; `''` and any unknown sentinel both localize to the generic fallback message             |
| apps/web  | `components/otp/otp-input-box.tsx` ~L70          | StringLiteral                                         | The slot list is fixed-length and never reorders, so the React `key` text is not observable                           |
| apps/web  | `components/charts/channel-badges.tsx` ~L36      | ConditionalExpression                                 | `asChannel` returns undefined only for unknown names, and `CHANNEL_SEVERITY[undefined]` is itself undefined           |
| apps/web  | `components/explorer/facet-rail.tsx` ~L25        | StringLiteral                                         | The empty-string "no active value" sentinel never equals a real facet value, so it highlights the same (zero) rows    |
| apps/web  | `components/explorer/explorer-content.tsx` ~L118 | BooleanLiteral                                        | The drawer renders only when open AND a row are set; on mount the selection is null, masking the initial open flag    |
| apps/web  | `components/explorer/log-table.tsx` ~L220        | ConditionalExpression, EqualityOperator               | When `liveRows` is empty, `[...historical, ...liveRows]` is content-identical to `historical`                         |
| apps/web  | `components/explorer/detail-drawer.tsx` ~L37     | ConditionalExpression, LogicalOperator, StringLiteral | A null/empty error key misses the lookup and falls through to the same `?? null`, so the guard is a fast path only    |
| apps/web  | `components/explorer/query-bar.tsx` ~L43         | StringLiteral, LogicalOperator                        | The recipient seed is re-synced from the URL by the mount effect, so the seed fallback is never the observed value    |
| apps/web  | `components/explorer/query-bar.tsx` ~L46         | StringLiteral, LogicalOperator                        | Same seed/effect masking as the recipient input — the URL is the observed source                                      |

---

## Accepted equivalent residuals (un-disable-able)

These 9 survivors are provable equivalents that **cannot** carry a `// Stryker disable` directive: each shares a
source line with a sibling mutant of the **same** mutator that IS killable, so a line-level disable would mask the
killable one. They are left as documented survivors rather than weakening a real test.

| Workspace | File                                       | Mutant                               | Why equivalent (and why not disabled)                                                                                                        |
| --------- | ------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web  | `lib/filters.ts` (ticker effect deps)      | ArrayDeclaration → `[]`              | Deps only shift teardown timing (documented at L171); Stryker's line attribution on `}, [deps])` keeps it surviving despite the directive    |
| apps/web  | `components/controls/live-toggle.tsx`      | `'default'` variant → `''`           | Badge/Button `defaultVariants.variant` is `'default'`, so `''` resolves to identical classes; sibling `'outline'` is killable                |
| apps/web  | `components/settings/config-status.tsx`    | `'default'` variant → `''`           | Same default-variant equivalence; sibling `'outline'` on the line is killed                                                                  |
| apps/web  | `components/settings/frozen-options.tsx`   | `'default'` variant → `''`           | Same default-variant equivalence; sibling `'outline'` on the line is killed                                                                  |
| apps/web  | `components/providers/provider-matrix.tsx` | `'default'` variant → `''`           | Same default-variant equivalence; sibling `'outline'` on the line is killed                                                                  |
| apps/web  | `components/providers/provider-matrix.tsx` | `'provider-matrix'` key → `''`       | A unique namespace label that never collides; the tenant stays in the key, so per-tenant caching is unchanged                                |
| apps/web  | `components/explorer/detail-drawer.tsx`    | Regex `\s*` → `\S*`                  | JSON never puts whitespace before a `:`, so `"code"\S*:` and `"code"\s*:` match identically; sibling `\s` mutant is killed                   |
| apps/web  | `components/otp/otp-verify-panel.tsx`      | `feedback.kind === 'message'` → true | `feedback.terminal` is truthy only when kind IS `'message'`, so `true && terminal ≡ kind==='message' && terminal`; sibling `false` is killed |
| apps/web  | `components/otp/otp-countdown-pill.tsx`    | `onExpired !== undefined` → true     | Spreading `{ onExpired: undefined }` vs `{}` passes the same (absent) callback to the hook; sibling `false` is killed                        |
