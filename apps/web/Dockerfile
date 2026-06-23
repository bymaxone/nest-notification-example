# syntax=docker/dockerfile:1

# Production image for the Next.js 16 notification console
# (`ghcr.io/bymaxone/nest-notification-example-web`).
#
# Build context is the REPO ROOT. NOTE: like the api image, this builds only once
# the application code exists and `@bymax-one/nest-notification` is published to
# npm — the local `file:`/`link:` spec resolves to a sibling checkout outside the
# Docker build context.
#
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# are passed as `--build-arg` from release.yml (they cannot be set at runtime).

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
WORKDIR /app
# All workspace manifests are required for a `--frozen-lockfile` install to match
# the lockfile's dependency graph.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
# prisma generate (postinstall) reads DATABASE_URL; a credential-free placeholder
# satisfies the schema reference without opening any connection.
ENV DATABASE_URL=postgresql://ci@localhost/placeholder
RUN pnpm install --frozen-lockfile

# ── build ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
WORKDIR /app
# NEXT_PUBLIC_* are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter web run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# apps/web console port.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# Next.js standalone server bundle (requires `output: 'standalone'`).
# With `outputFileTracingRoot` at the repo root, the entrypoint is emitted at
# `apps/web/server.js` and traced deps live in the standalone `node_modules`.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
