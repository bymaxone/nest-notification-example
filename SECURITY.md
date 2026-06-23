# Security Policy

`nest-notification-example` is the public reference application for
`@bymax-one/nest-notification`. It handles material that must never leak — OTP
codes, recipient email addresses, and per-tenant audit records — so we triage
security reports ahead of feature work.

## Supported versions

This repository tracks **one library minor at a time** (see
[docs/RELEASES.md](docs/RELEASES.md)). Security fixes land on the tip of the
default branch; there are no long-lived release branches to back-port to.

| Branch / version       | Status                              |
| ---------------------- | ----------------------------------- |
| `main` (current minor) | ✅ Active — receives security fixes |
| Older tags / forks     | ❌ Best effort only                 |

A vulnerability in the **library itself** (`@bymax-one/nest-notification`)
should be reported against [its repository](https://github.com/bymaxone/nest-notification),
not here. Report it here only if it is reproducible through this example's own
demo code.

## Reporting a vulnerability

**Do not report security issues through public GitHub Issues, Discussions, or
pull requests.** Public reports give attackers a window between disclosure and
fix.

Email **support@bymax.one** with `[security] nest-notification-example` in the
subject line. If you prefer, you may instead open a GitHub
[private security advisory](https://github.com/bymaxone/nest-notification-example/security/advisories/new).

### What to include

- A clear description of the vulnerability and its impact.
- Step-by-step reproduction against the default branch.
- The affected surface (an API route, the console, the build/CI, a dependency).
- A suggested fix or mitigation, if you have one.
- Whether you would like to be credited (and how).

### Response timeline

| Stage                                  | Target              |
| -------------------------------------- | ------------------- |
| Acknowledgement of receipt             | within **72 hours** |
| Initial assessment and severity rating | within **7 days**   |
| Coordinated fix for Critical / High    | within **90 days**  |
| Coordinated fix for Medium / Low       | best effort         |

We follow
[coordinated vulnerability disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure)
and credit reporters unless they request anonymity.

## In scope

- **OTP code exposure** — a code reaching a log line, an error body, an HTTP
  header, or the audit record.
- **Recipient PII leakage** — an unmasked email address in the audit log,
  responses, or logs.
- **Tenant isolation bypass** — reading or writing another tenant's OTP entries
  or audit rows; spoofing the trusted tenant source.
- **Injection** — email header / template injection, SQL injection, SSRF from a
  provider or webhook URL.
- **Secret leakage** — credentials committed to the repo or printed at runtime.
- **Supply-chain integrity** — a compromised dependency or tampered release
  artifact, and anything CodeQL `security-extended` surfaces.

## Out of scope

- Misconfiguration in a **consuming application** (weak secrets, missing HTTPS)
  that does not reproduce with the documented defaults.
- Findings only reproducible against the local-only demo adapters (Mailpit, the
  in-memory OTP store) running outside their intended local context.
- Theoretical attacks without a practical demonstration.

## Hardening references

The multi-tenant and recipient-privacy model — sha256 keys, the trusted
`tenantIdResolver`, `maskRecipient`, and the never-log-codes rule — is described
in [docs/OVERVIEW.md §13](docs/OVERVIEW.md#13-multi-tenant-security--recipient-privacy).
