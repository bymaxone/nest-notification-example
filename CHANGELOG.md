# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.1.0] - 2026-06-24

### Added

- Repository foundation: the pnpm + TypeScript workspace, the lint / format /
  commit governance (ESLint flat config, Prettier, commitlint, husky,
  lint-staged), and the community-health files (LICENSE, SECURITY, CONTRIBUTING,
  CODE_OF_CONDUCT, agent guides).
- The CI/CD and go-public scaffolding: the `ci` pipeline, the CodeQL, OpenSSF
  Scorecard, secret-scan, mutation, and release workflows, dependency
  automation, and the GitHub Copilot review configuration.
- `apps/api` (NestJS 11 + Express 5): full notification wiring via
  `BymaxNotificationModule.forRootAsync`, the complete OTP + Email + Dispatch +
  Audit + Admin + Debug controller surface, `PrismaNotificationLogRepository`,
  `NodemailerEmailProvider` → Mailpit (zero-credential default), `RedisOtpStorage`
  (opt-in), the `DefaultTemplateRenderer` + Handlebars/MJML/React Email renderer
  demos, the `NotificationAuthEmailProvider` optional adapter, and the
  `NotificationAuditInterceptor`.
- `apps/web` (Next.js 16 + React 19): the Notification Console with seven panels
  (Overview, Trigger Center, Audit Explorer, OTP Verify, Providers & Templates,
  Roadmap, Settings), `useOtpInput` segmented 6-cell box, `useOtpCountdown` expiry
  pill, SSE live tail, and the shared Bymax design system (forced dark, orange
  `#ff6224` glass, Geist + mono).
- 100% test coverage (Jest 30 for `apps/api`, Vitest 4 for `apps/web`) and
  Stryker mutation gate (≥ 95 on both apps).
- The full doc-set: GETTING_STARTED, FEATURES, ARCHITECTURE, DATABASE, DASHBOARD,
  ENVIRONMENT, PROVIDERS, TEMPLATING, MULTI_TENANCY, AUTH_INTEGRATION, DEPLOYMENT,
  TROUBLESHOOTING, RELEASES.
- Two GHCR container images (`nest-notification-example-api` / `…-web`) published
  via `release.yml` on this tag (OIDC, multi-stage Dockerfiles).

> **Library status:** consumes `@bymax-one/nest-notification@^0.1.0` (pre-publish,
> via a local `file:` link to the sibling checkout) until the library ships to
> npm. See [docs/RELEASES.md](docs/RELEASES.md) for the tracked version per branch.
