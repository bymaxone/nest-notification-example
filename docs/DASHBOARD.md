# Dashboard

The `apps/web` notification console — information architecture, global controls, the SSE live-tail design,
and the shared design system.

For the backing API, see **[ARCHITECTURE.md](./ARCHITECTURE.md)** and **[DATABASE.md](./DATABASE.md)**.

---

## Information architecture

Seven left-nav destinations, all driven by the shared Bymax design system (forced dark, orange `#ff6224`
glass, Geist + mono). Every view is a shareable deep-link: state (active tab, filter, cursor) is persisted in
the URL via `nuqs`.

| Route        | Page                      | Job                                                                                                                                                                                       |
| ------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | **Overview**              | Delivery health: send/verify/failure rates, provider mix, channel badges. Reads `GET /audit/aggregate`.                                                                                  |
| `/trigger`   | **Trigger Center**        | The Playground — fire every feature (send email, generate+verify OTP, trip cooldown, force max-attempts, oversize attachment, spoof tenant, dispatch). Auto-pivots the Explorer to the resulting audit row. |
| `/explorer`  | **Audit Explorer**        | Search/filter the delivery log (tenant/channel/verb/recipient/purpose + a **source** facet), virtualized table, detail drawer (Overview / Raw entry / never-contains-code proof), live tail over SSE. |
| `/otp`       | **OTP Verify**            | The end-to-end OTP UX — `useOtpInput` segmented 6-cell box + `useOtpCountdown` expiry pill + cooldown-gated resend. Surfaces `remainingAttempts` and every `OTP_*` error localized from `./shared`. |
| `/providers` | **Providers & Templates** | The provider matrix (email provider + storage + renderer, each with health/active state) and an **email preview** (Rendered / HTML / Text / Metadata tabs) proving HTML-escape-html-body-only behavior. |
| `/roadmap`   | **Roadmap**               | Honest v0.2 preview — clicking "Enable SMS" / "Enable Push" / "Use useClass" surfaces the library's actual startup-rejection error string.                                               |
| `/settings`  | **Settings**              | Channel/provider config status and the RBAC roles. Note: `consumeOnVerify` and `swallowErrors` are resolved once at boot (frozen options), so the Settings page **shows the configured value** — flipping them at runtime requires a second module variant (see [FEATURES.md §10](./FEATURES.md#10-audit-fault-tolerance)). |

---

## Global controls

A persistent top bar carries three global controls that every page reads:

| Control             | What it sets                                          | How it works                                                                                                                                        |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant switcher** | `x-tenant-id` header on every API request             | Persisted in the URL via `nuqs`. Switching between `acme` and `globex` isolates every OTP, audit filter, and spoof-tenant proof to that tenant.     |
| **Role switcher**   | `x-role` header (Viewer / Operator / Admin)           | Header-based demo RBAC — informational only; a real deployment uses `@bymax-one/nest-auth` for server-side verification. Settings panel shows the bound role and its capabilities. |
| **Live toggle**     | Engages/pauses the SSE tail in the Audit Explorer     | When on, new audit rows stream in real time as the Trigger Center fires them.                                                                       |

---

## Declared-not-built surfaces

Two console cards were declared in the original roadmap but not built — the required backend is not present:

- **Break audit sink** (Trigger Center): documented in the Roadmap panel; the module-variant endpoint
  `POST /admin/try-configure-*` demonstrates swallowErrors behavior, but a live "break-the-running-audit-sink"
  card would need a fault-injection endpoint that does not exist. Use journey 10 (`swallowErrors:false` variant)
  instead.
- **Latency-percentile panel** (Overview): there is no `durationMs` column in `NotificationLog`. The Overview
  charts cover send/verify/failure rates and provider mix from `GET /audit/aggregate`.

These are honest limitations, not bugs — they match how SMS/Push are declared-but-rejected (visible in the
Roadmap panel).

---

## The SSE live-tail architecture

`GET /audit/stream` is a `@Sse`-decorated endpoint in `apps/api` that returns an
`rxjs Observable<MessageEvent>`. Each event's `id` is the row's keyset cursor (`<timestamp>_<uuid>`) so a
browser can resume from `Last-Event-ID` after a reconnect and avoid re-receiving rows already displayed.

The Explorer implements **follow mode**:

1. When live mode is on and the table is scrolled to the bottom, new rows are appended and the viewport
   follows (pinned-to-bottom auto-scroll).
2. Scrolling up **pauses** follow mode. An "N new — jump to latest" pill appears at the bottom of the
   viewport; clicking it resumes follow mode and jumps back to the newest row.
3. The SSE connection is managed by `apps/web/lib/sse.ts` and bridged into TanStack Query for consistent
   loading/error states.

The SSE stream is unaffected by Helmet's CSP headers because the API serves JSON events (no HTML frames),
and the CORS config explicitly allows the `x-tenant-id` header from `WEB_ORIGIN`.

---

## Panel and chart catalog

### Overview (`/`)

- **Send rate** — percentage of `sent` verbs in the selected time window.
- **Verify rate** — percentage of `verified` verbs.
- **Failure rate** — percentage of `failed` verbs.
- **Provider mix** — pie/bar chart of sends by `providerName`.
- **Channel badges** — live `GET /channels` result (email ✅, otp ✅, sms ❌, push ❌).

### Trigger Center (`/trigger`)

One card per library feature group: Send Email, Send Template, OTP lifecycle (generate/verify/resend/consume),
Unified Dispatch, Oversize Attachment, Spoof Tenant, Break Audit (module variant), Roadmap Rejection probes.
Each card shows the request payload, the response, and auto-navigates the Explorer to the resulting row.

### Audit Explorer (`/explorer`)

- **Filter bar** — tenant, channel, verb, recipient, purpose, source facet (`providerName === '__interceptor__'`).
- **Virtualized table** (TanStack Virtual) — handles thousands of rows without DOM thrash.
- **Detail drawer** — three tabs: Overview (key fields), Raw JSON entry, and the never-contains-code proof
  (`JSON.stringify(entry).includes(submittedCode) === false` rendered as a green check).
- **Live tail** — follow mode via SSE (described above).

### OTP Verify (`/otp`)

- **`useOtpInput` segmented box** — 6 cells, paste-aware, auto-advance on correct digit, backspace navigates
  left. `autoSubmit` and `sanitizeOnPaste` are togglable from Settings.
- **`useOtpCountdown` expiry pill** — ticks to zero; `formatted` returns `MM:SS` or `HH:MM:SS`.
- **Resend button** — disabled while cooldown is active; shows `formatCooldown(remainingSeconds)`.
- **Inspect OTP** panel — calls `GET /otp/status` and shows the `sha256` storage key from `GET /debug/key`.

### Providers & Templates (`/providers`)

- **Provider matrix** — email provider (`nodemailer` / `resend` / `no-op`) + OTP storage
  (`redis` / `in-memory`) + renderer (`default` / `handlebars` / `mjml` / `react-email`), each with
  health/active state from `GET /channels`.
- **Email preview** — four tabs (Rendered / HTML / Text / Metadata), driven by `POST /email/send-template`.
  The "XSS inject" toggle proves HTML-body-only escaping. The renderer switch changes the active
  `IEmailTemplateRenderer` demo.

### Roadmap (`/roadmap`)

Three cards: Enable SMS, Enable Push, Use `useClass`. Each calls the matching `POST /admin/try-configure-*`
endpoint and surfaces the library's real startup-rejection error string as a code block — honest v0.2 preview.

### Settings (`/settings`)

Reads `GET /channels` for live channel config, displays `consumeOnVerify` and `swallowErrors` (frozen at
boot), and shows the current RBAC role from `x-role`. The `autoSubmit` / `sanitizeOnPaste` toggles for the
OTP box are persisted here (in-memory, not the API).

---

## Design system (verbatim)

The `apps/web` design files — `globals.css`, `tailwind.config.ts`, `components.json`, and `components/ui/*`
— are copied **byte-identical** from the sibling `nest-logger-example` app and must never be re-styled or
overridden. The shared Bymax design system uses:

- **Forced dark mode** — `class="dark"` on `<html>`, no light-mode toggle.
- **Orange `#ff6224` glass** — the primary accent color used for active states, badges, and the OTP box ring.
- **Geist** (sans) + **Geist Mono** (mono) — loaded via `next/font`.
- **shadcn/ui `new-york`** components — `Button`, `Card`, `Badge`, `Dialog`, `Select`, `Input`, `Separator`,
  and the sonner toast — all dark-mode native, no theming needed.
- **TanStack Query** for server state, **TanStack Table** for the audit table, **TanStack Virtual** for
  viewport-bounded rendering, **Recharts** for the Overview charts, **nuqs** for URL-persisted state, and
  **sonner** for toasts.

The `design_system.html` file in `docs/` is the canonical visual reference — open it in a browser to see
every primitive rendered.

---

## See also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the delivery pipeline and the `apps/api` module map
- [DATABASE.md](./DATABASE.md) — `NotificationLog` schema and the keyset / SSE / aggregate queries
- [FEATURES.md](./FEATURES.md) — all 13 end-to-end journeys with `curl` and dashboard steps
- [OVERVIEW.md §10](./OVERVIEW.md#10-the-demo-domain--notification-console) — full console blueprint
