# OMNIDAT telnet PAD bridge.
#
# Build context is the monorepo root (gmacko/):
#   docker build -f packages/pad-telnet/Dockerfile -t omnidat-pad .
#
# The daemon bundles @omnidat/operator-core, so the runtime image carries only
# node + a single self-contained dist/index.js — no node_modules at runtime.

# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Workspace manifests first for cached installs.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/operator-core/package.json ./packages/operator-core/
COPY packages/pad-telnet/package.json ./packages/pad-telnet/
COPY tooling ./tooling
RUN pnpm install --filter @omnidat/pad-telnet... --frozen-lockfile || pnpm install --filter @omnidat/pad-telnet...

# Sources for the two packages the daemon needs.
COPY packages/operator-core ./packages/operator-core
COPY packages/pad-telnet ./packages/pad-telnet
RUN pnpm --filter @omnidat/pad-telnet build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2525
ENV HOST=0.0.0.0
ENV PAD_IDLE=45
COPY --from=build /app/packages/pad-telnet/dist/index.js ./index.js
EXPOSE 2525
# Unprivileged.
USER node
CMD ["node", "index.js"]
