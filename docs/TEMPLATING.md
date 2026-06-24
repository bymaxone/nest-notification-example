# Templating

The `IEmailTemplateRenderer` contract, the canonical templates, the Handlebars / MJML / React Email renderer
demos, locale fallback, and the XSS-escape guarantee.

For the provider that delivers the rendered email, see **[PROVIDERS.md](./PROVIDERS.md)**.

---

## The `IEmailTemplateRenderer` contract

```typescript
interface IEmailTemplateRenderer {
  /** Human-readable renderer name (surfaced in audit rows and the Providers panel). */
  readonly name: string

  /** Return true when this renderer has a registered template for the given name + locale. */
  hasTemplate(name: string, locale: string): boolean

  /**
   * Render the named template in the requested locale.
   * Falls back to the default locale (`'en'`) when the requested locale is not registered.
   * Throws TEMPLATE_NOT_FOUND when neither the requested locale nor the fallback is registered.
   */
  render(name: string, locale: string, data: Record<string, unknown>): RenderedEmail
}
```

`RenderedEmail` is `{ subject: string; html: string; text?: string }`. Renderers must be stateless after
construction — `render` may be called concurrently.

---

## The canonical template names

`CANONICAL_EMAIL_TEMPLATES` exports 10 well-known template names that map to standard auth / notification
events. `apps/api/src/notification/templates.ts` registers all 10 for the `en` locale:

| Constant key             | Wire name (string value) | Event                                           |
| ------------------------ | ------------------------ | ----------------------------------------------- |
| `OTP_CODE`               | `otp_code`               | Email-verification / transactional OTP delivery |
| `OTP_PASSWORD_RESET`     | `otp_password_reset`     | Password-reset OTP delivery                     |
| `WELCOME`                | `welcome`                | New-user welcome email                          |
| `MFA_ENABLED`            | `mfa_enabled`            | MFA enabled notification                        |
| `MFA_DISABLED`           | `mfa_disabled`           | MFA disabled notification                       |
| `NEW_LOGIN_ALERT`        | `new_login_alert`        | New-device sign-in alert                        |
| `PASSWORD_RESET_SUCCESS` | `password_reset_success` | Password reset confirmed                        |
| `EMAIL_CHANGED`          | `email_changed`          | Email address changed                           |
| `ACCOUNT_LOCKED`         | `account_locked`         | Account locked (brute-force)                    |
| `INVITATION`             | `invitation`             | Team / tenant invitation                        |

Two additional app-registered templates are added in `templates.ts`:

| Wire name             | Event                                   |
| --------------------- | --------------------------------------- |
| `password_reset_link` | Link-based (token) password reset email |
| (further app names…)  | Any other template the app needs        |

---

## Template keys

Templates are registered as `${templateName}::${locale}` strings. `templates.ts` only ships the `en` locale;
locale fallback (described below) handles other locales automatically.

```typescript
const TEMPLATES: Record<string, TemplateDefinition> = {
  [`${CANONICAL_EMAIL_TEMPLATES.OTP_CODE}::en`]: {
    subject: 'Your {{appName}} verification code',
    html: '<p>Hi {{name}}, your verification code is <strong>{{code}}</strong>. It expires in {{expiresInMinutes}} minutes.</p>',
    text: 'Hi {{name}}, your verification code is {{code}}. It expires in {{expiresInMinutes}} minutes.',
  },
  // … all other canonical templates
}
```

---

## OTP email auto-injection

When `OtpService.generate` delivers via email, it injects `{ code, expiresInMinutes, purpose }` into the
render data automatically. The controller and the template never pass the code explicitly — it is merged in
by the library at delivery time, after the template is fetched, so the code never appears in any log call or
intermediate variable visible to the application layer.

---

## The `DefaultTemplateRenderer` (XSS-safe)

The bundled `DefaultTemplateRenderer` uses `{{var}}` `mustache`-style interpolation and applies
**HTML-escaping to the `html` body only** — subject and text are not HTML contexts and are passed through
unchanged.

This distinction is important: a subject line containing `<script>alert(1)</script>` must arrive in the
email client exactly as typed (the email client may render it as plain text). Escaping it would produce a
garbled subject. The html body, however, is rendered by the email client as markup, so injection there is
an XSS vector. The renderer escapes `<`, `>`, `"`, `'`, and `&` in the html body only.

**Prove it:**

```bash
curl -sS -X POST http://localhost:3001/email/send-template \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{
    "to": "alice@acme.com",
    "template": "welcome",
    "locale": "en",
    "data": { "name": "<script>alert(1)</script>", "appName": "Demo", "appUrl": "http://localhost:3003" }
  }'
```

In Mailpit, the html body contains `&lt;script&gt;alert(1)&lt;/script&gt;`. The subject and text contain
the raw string. The Email preview panel (`/providers`) has an "XSS inject" toggle that drives this proof.

### Renderer options

| Option              | Values                 | Default   | Effect                                                                           |
| ------------------- | ---------------------- | --------- | -------------------------------------------------------------------------------- |
| `onMissingVar`      | `'empty'` \| `'throw'` | `'empty'` | `'empty'` replaces an undefined placeholder with `''`; `'throw'` raises an error |
| `enableNestedPaths` | `boolean`              | `false`   | Allows `{{user.name}}` dot-path syntax                                           |

---

## Locale fallback

The resolver tries `${name}::${locale}` first, then `${name}::${defaultLocale}` (`en` by default). A
`TEMPLATE_NOT_FOUND` error is thrown only when neither locale is registered.

```bash
# pt-BR requested — only en registered — falls back silently to en
curl -sS -X POST http://localhost:3001/email/send-template \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "to": "alice@acme.com", "template": "welcome", "locale": "pt-BR", "data": { … } }'
# → 200 OK (en rendered)

# Non-existent template — TEMPLATE_NOT_FOUND (404)
curl -sS -X POST http://localhost:3001/email/send-template \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: acme' \
  -d '{ "to": "alice@acme.com", "template": "does_not_exist", "locale": "en", "data": {} }'
# → 404 TEMPLATE_NOT_FOUND
```

---

## Alternate renderers — showcase

`apps/api/src/notification/renderers/` ships three renderer demos that exercise the `IEmailTemplateRenderer`
swap-ability. The Providers panel (`/providers`) lets you switch between them at runtime.

### `HandlebarsTemplateRenderer`

Uses the Handlebars compiler. Supports conditionals (`{{#if}}`), iteration (`{{#each}}`), partials, and
helpers that the default renderer does not. Handlebars HTML-escapes `{{var}}` interpolations by default;
raw triple-stache `{{{var}}}` bypasses that — use it only for trusted, pre-sanitized HTML.

```typescript
// apps/api/src/notification/renderers/handlebars.renderer.ts (shape)
export class HandlebarsTemplateRenderer implements IEmailTemplateRenderer {
  readonly name = 'handlebars'
  constructor(templates: Record<string, HandlebarsRawTemplate>) { … }
  hasTemplate(name: string, locale: string): boolean { … }
  render(name: string, locale: string, data: Record<string, unknown>): RenderedEmail { … }
}
```

### `MjmlTemplateRenderer`

Uses MJML to compile responsive email markup into the table-based HTML that email clients render correctly.
The MJML source is compiled once at construction; `render` executes the compiled template and returns the
full HTML output.

```typescript
export class MjmlTemplateRenderer implements IEmailTemplateRenderer {
  readonly name = 'mjml'
  constructor(templates: Record<string, MjmlRawTemplate>) { … }
  …
}
```

### `ReactEmailTemplateRenderer`

Uses `@react-email/render` to render React components to HTML strings. Each template is a React component
that receives the data as props.

```typescript
export class ReactEmailTemplateRenderer implements IEmailTemplateRenderer {
  readonly name = 'react-email'
  constructor(templates: Record<string, ReactEmailRawTemplate>) { … }
  …
}
```

---

## Wiring a renderer in `notification.config.ts`

```typescript
email: {
  templateRenderer: new DefaultTemplateRenderer({ templates: TEMPLATES }),
  // or: new HandlebarsTemplateRenderer(HANDLEBARS_TEMPLATES)
  // or: new MjmlTemplateRenderer(MJML_TEMPLATES)
  // or: new ReactEmailTemplateRenderer(REACT_TEMPLATES)
  …
}
```

Only one renderer is active at a time. The renderer switch in the Providers panel changes the active demo
renderer for the email preview — it does not hot-reload the running API.

---

## See also

- [PROVIDERS.md](./PROVIDERS.md) — `IEmailProvider` and `IOtpStorage` wiring
- [FEATURES.md §6](./FEATURES.md#6-template-render--xss-guard) — XSS-guard journey
- [FEATURES.md §7](./FEATURES.md#7-locale-fallback) — locale fallback journey
- [OVERVIEW.md §12](./OVERVIEW.md#12-channels--providers-showcase) — the full provider/renderer table
