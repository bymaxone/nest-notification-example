# Releases

Which version of `@bymax-one/nest-notification` each branch of this example tracks. Because the library is
pre-1.0, the tracking is explicit — a minor library bump can change behavior, so every release on `main`
records the exact version it was tested against.

---

## Branch → library version

| Branch | Tracks library version | Notes                                                                                                            |
| ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `main` | `^0.1.0` (pre-1.0)     | Current — local `file:`/`link:` to `../nest-notification` until first publish, then the published `^0.1.0` range |
| `next` | upcoming minor         | Tracks v0.2 (SMS + Push) when the library implements those channels; the roadmap panel becomes real delivery     |

Until the first npm publish, the local `file:`/`link:` **is** how `main` resolves the package — see
[OVERVIEW.md §7](./OVERVIEW.md#7-library-consumption). Once `@bymax-one/nest-notification` is on npm, `main`
declares the published semver range and the link is reserved for side-by-side development.

---

## Tested-version log

Each row records the exact library version a release on `main` was verified against. The release automation
appends a row when a `v*` tag is cut; until the library publishes, the tracked version is the local checkout.

| Date      | Example version | Library version                 | Notes                                           |
| --------- | --------------- | ------------------------------- | ----------------------------------------------- |
| _pending_ | _pre-release_   | `0.1.0` (local `file:`/`link:`) | Pre-publish; consumed from the sibling checkout |

> Rows are appended by the release workflow on each `v*` tag (build → push images → record the resolved
> `@bymax-one/nest-notification` version). Versions are never fabricated; the table reflects only verified
> releases.

---

## Versioning policy

- The example follows the library's **major** line: each future major of `@bymax-one/nest-notification` gets its
  own long-lived branch here.
- When the library reaches `1.0.0`, `main` flips its range to `^1.0.0` and the 0.x branch is archived.
- The container images are published to GHCR as `ghcr.io/bymaxone/nest-notification-example-api` and
  `ghcr.io/bymaxone/nest-notification-example-web`, tagged with the release version.
