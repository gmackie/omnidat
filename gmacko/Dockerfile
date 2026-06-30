# syntax=docker/dockerfile:1

# ============================================
# Base image with pnpm
# ============================================
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ============================================
# Dependencies stage - install all deps
# ============================================
FROM base AS deps

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY .npmrc* ./

# Copy all package.json files for workspace resolution
COPY apps/nextjs/package.json ./apps/nextjs/
COPY packages/api/package.json ./packages/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/logging/package.json ./packages/logging/
COPY packages/monitoring/package.json ./packages/monitoring/
COPY packages/operator-core/package.json ./packages/operator-core/
COPY packages/realtime/package.json ./packages/realtime/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/ui/package.json ./packages/ui/
COPY packages/validators/package.json ./packages/validators/
COPY packages/settings/package.json ./packages/settings/
COPY tooling/tailwind/package.json ./tooling/tailwind/
COPY tooling/typescript/package.json ./tooling/typescript/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Builder stage - build the app
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/nextjs/node_modules ./apps/nextjs/node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/

# Copy source code
COPY . .

# Build arguments
ARG DATABASE_URL
ARG AUTH_SECRET
ARG OMNIDAT_DB_SCHEMA=omnidat
ARG APP_URL=https://omnidat.gmac.io
ARG NEXT_PUBLIC_APP_URL=https://omnidat.gmac.io
ARG SKIP_ENV_VALIDATION=true
ARG DOCKER_BUILD=true

# Set environment for build
ENV DATABASE_URL=${DATABASE_URL}
ENV AUTH_SECRET=${AUTH_SECRET}
ENV OMNIDAT_DB_SCHEMA=${OMNIDAT_DB_SCHEMA}
ENV APP_URL=${APP_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}
ENV DOCKER_BUILD=${DOCKER_BUILD}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN pnpm turbo run build --filter=@omnidat/nextjs

# ============================================
# Runner stage - production image
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV OMNIDAT_DB_SCHEMA=omnidat
ENV APP_URL=https://omnidat.gmac.io
ENV NEXT_PUBLIC_APP_URL=https://omnidat.gmac.io
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextjs/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextjs/.next/static ./apps/nextjs/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextjs/public ./apps/nextjs/public

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "apps/nextjs/server.js"]
