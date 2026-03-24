# ================================================================
# Loocbooc Web — Multi-stage Dockerfile
# ================================================================
# Next.js 14 App Router frontend for consumers, brands,
# manufacturers, stylists, and admins.
# ================================================================

# ── Stage 1: Install Dependencies ──────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.jsons for all workspaces
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY apps/web/package.json apps/web/package.json

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/packages/design-system/node_modules ./packages/design-system/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY packages/design-system ./packages/design-system
COPY apps/web ./apps/web
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Build packages in order
RUN pnpm --filter @loocbooc/types build || true
RUN pnpm --filter @loocbooc/utils build || true
RUN pnpm --filter @loocbooc/design-system build || true

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @loocbooc/web build

# ── Stage 3: Production Image ──────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))" || exit 1

# Start Next.js server
CMD ["node", "apps/web/server.js"]
