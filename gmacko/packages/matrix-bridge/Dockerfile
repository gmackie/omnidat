# OMNIDAT Matrix bridge server.
#
# Build context is the monorepo root (gmacko/):
#   docker build -f packages/matrix-bridge/Dockerfile -t omnidat-bridge .
#
# The server has no runtime dependencies beyond node builtins, so the bundle is a
# single self-contained dist/index.js.

# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/matrix-bridge/package.json ./packages/matrix-bridge/
COPY tooling ./tooling
RUN pnpm install --filter @omnidat/matrix-bridge... --frozen-lockfile || pnpm install --filter @omnidat/matrix-bridge...
COPY packages/matrix-bridge ./packages/matrix-bridge
RUN pnpm --filter @omnidat/matrix-bridge build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8090
ENV HOST=127.0.0.1
ENV BRIDGE_STORE=/data/journal.jsonl
COPY --from=build /app/packages/matrix-bridge/dist/index.js ./index.js
VOLUME ["/data"]
USER node
CMD ["node", "index.js"]
