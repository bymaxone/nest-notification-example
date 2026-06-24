/**
 * @fileoverview Pre-flight for the live Playwright run — make the environment safe and ready.
 *
 * Wired into the `test:e2e` script (runs before `playwright test`) so a local run never
 * fails on stale state. Three idempotent, non-destructive steps:
 *
 *   1. Docker daemon — reuse it if already running, otherwise start Docker Desktop (macOS)
 *      and wait until it answers, instead of letting `docker compose` error out.
 *   2. Test stack — `docker compose -f docker-compose.test.yml up -d --wait` reuses healthy
 *      containers (Postgres :55432, Redis :56379, Mailpit host :51025/:58025) and starts missing.
 *   3. Stale dev servers — Playwright's `reuseExistingServer` (local only) reattaches to whatever
 *      already listens on the e2e ports. Each port is probed for a genuine 2xx so an unrelated
 *      process answering with a 4xx is never mistaken for a reusable server; a healthy server is
 *      kept (fast reuse). A non-healthy occupant is killed ONLY when `E2E_KILL_STALE=1` is set
 *      (opt-in, since the occupant may be an unrelated local process); otherwise the run aborts
 *      with instructions rather than killing an unknown process.
 *
 * Exit code is 0 on success; non-zero only when Docker genuinely cannot be made ready.
 *
 * @module e2e/ensure-stack
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Repo root — where `docker compose` resolves the compose file. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
/** Dedicated, throwaway test stack (Postgres :55432, Redis :56379, Mailpit host :51025/:58025). */
const COMPOSE_FILE = 'docker-compose.test.yml'
/** How long to wait for the Docker daemon to come up after starting it. */
const DOCKER_READY_TIMEOUT_MS = 90_000
/** Per-probe network timeout when checking whether a server is really serving. */
const PROBE_TIMEOUT_MS = 3000

/** The servers Playwright brings up, each with a readiness probe. */
const SERVERS = [
  { name: 'api', port: 3001, probe: () => probe('http://127.0.0.1:3001/health') },
  { name: 'web', port: 3003, probe: () => probe('http://127.0.0.1:3003/') },
]

/** Emit a single tagged progress line so the prep is visible in the test output. */
function log(message) {
  process.stdout.write(`[e2e:ensure-stack] ${message}\n`)
}

/**
 * Run a command, returning its stdout; throws on a non-zero exit. With `stdio: 'inherit'`
 * `execSync` returns `null` (nothing is captured), so coalesce to an empty string.
 */
function run(cmd, opts = {}) {
  const out = execSync(cmd, { stdio: 'pipe', ...opts })
  return out === null ? '' : out.toString()
}

/** Run a command, swallowing failure into a boolean so callers can branch on it. */
function tryRun(cmd, opts = {}) {
  try {
    run(cmd, opts)
    return true
  } catch {
    return false
  }
}

/** Resolve after `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True when the Docker daemon answers `docker info` (i.e. it is running). */
function dockerDaemonReady() {
  return tryRun('docker info')
}

/**
 * GET `url` and report whether the INTENDED server is serving. Only a genuine 2xx counts as
 * healthy: a 4xx/5xx (or a network error) means the port is either down or held by an unrelated
 * process, so it must not be treated as a reusable e2e server. The API probe hits `/health`
 * (expects 200) and the web probe hits `/` (expects 200).
 *
 * @returns `true` when the server responded with a 2xx, `false` otherwise.
 */
async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return res.ok
  } catch {
    return false
  }
}

/** PIDs listening on a TCP port (empty when the port is free). macOS/Linux `lsof`. */
function pidsOnPort(port) {
  try {
    return run(`lsof -tiTCP:${port} -sTCP:LISTEN`)
      .split('\n')
      .map((pid) => pid.trim())
      .filter(Boolean)
  } catch {
    // `lsof` exits non-zero when nothing is listening — that is simply "port free".
    return []
  }
}

/** Ensure the Docker daemon is running: reuse it if up, otherwise start it and wait. */
async function ensureDockerDaemon() {
  if (dockerDaemonReady()) {
    log('Docker daemon already running — reusing it.')
    return
  }
  if (process.platform !== 'darwin') {
    log('Docker daemon is not running. Start Docker and re-run the e2e suite.')
    process.exit(1)
  }
  log('Docker daemon not running — starting Docker Desktop…')
  tryRun('open -a Docker')
  const deadline = Date.now() + DOCKER_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(3000)
    if (dockerDaemonReady()) {
      log('Docker daemon is up.')
      return
    }
  }
  log('Docker did not become ready in time. Start Docker Desktop and re-run.')
  process.exit(1)
}

/** Bring the test stack up idempotently (reuses healthy containers, starts missing ones). */
function ensureTestStack() {
  log('Ensuring the test stack is up (docker compose up -d --wait)…')
  try {
    run(`docker compose -f ${COMPOSE_FILE} up -d --wait --wait-timeout 180`, {
      cwd: ROOT,
      stdio: 'inherit',
    })
    log('Test stack healthy.')
  } catch {
    log(
      'Failed to bring up the test stack. Inspect `docker compose -f docker-compose.test.yml ps`.',
    )
    process.exit(1)
  }
}

/**
 * Keep healthy e2e servers (fast reuse) and clear non-healthy occupants so Playwright can
 * restart them. A non-healthy occupant is killed only when `E2E_KILL_STALE=1` is set — the
 * process on the port may be unrelated local work, so killing it is strictly opt-in. Without
 * the opt-in, the run aborts with instructions instead of force-killing an unknown process.
 */
async function reapStaleServers() {
  const killOptIn = process.env.E2E_KILL_STALE === '1'
  for (const server of SERVERS) {
    const pids = pidsOnPort(server.port)
    if (pids.length === 0) {
      log(`:${server.port} ${server.name} — free; Playwright will start it.`)
      continue
    }
    if (await server.probe()) {
      log(`:${server.port} ${server.name} — healthy; reusing.`)
      continue
    }
    if (!killOptIn) {
      log(
        `:${server.port} ${server.name} — occupied by a non-healthy process (pid(s) ${pids.join(
          ', ',
        )}). Refusing to kill an unknown process. Stop it yourself, or re-run with ` +
          `E2E_KILL_STALE=1 to have this script free the port.`,
      )
      process.exit(1)
    }
    log(
      `:${server.port} ${server.name} — stale; E2E_KILL_STALE=1 set, killing pid(s) ${pids.join(
        ', ',
      )} for a fresh start.`,
    )
    for (const pid of pids) tryRun(`kill -9 ${pid}`)
  }
}

await ensureDockerDaemon()
ensureTestStack()
await reapStaleServers()
log('Environment ready.')
