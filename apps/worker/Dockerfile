# ================================================================
# Loocbooc Worker — Multi-stage Dockerfile
# ================================================================
# BullMQ worker process for background jobs.
# Handles: MOQ checks, Shopify sync, email notifications,
# remaining payment captures, taste engine updates.
# ================================================================

# ── Stage 1: Install Dependencies ──────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.jsons for all workspaces
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/config/package.json packages/config/package.json
COPY apps/worker/package.json apps/worker/package.json

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/utils/node_modules ./packages/utils/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules

# Copy source code
COPY packages/database ./packages/database
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/worker ./apps/worker
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build packages in order
RUN pnpm --filter @loocbooc/types build || true
RUN pnpm --filter @loocbooc/utils build || true
RUN pnpm --filter @loocbooc/database build || true
RUN pnpm --filter @loocbooc/worker build

# ── Stage 3: Production Image ──────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 loocbooc

# Copy built artifacts
COPY --from=builder --chown=loocbooc:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=loocbooc:nodejs /app/packages/database/generated ./packages/database/generated
COPY --from=builder --chown=loocbooc:nodejs /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=loocbooc:nodejs /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder --chown=loocbooc:nodejs /app/packages/types/dist ./packages/types/dist
COPY --from=builder --chown=loocbooc:nodejs /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder --chown=loocbooc:nodejs /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder --chown=loocbooc:nodejs /app/packages/utils/package.json ./packages/utils/package.json
COPY --from=builder --chown=loocbooc:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=loocbooc:nodejs /app/apps/worker/package.json ./apps/worker/package.json

# Copy node_modules (production only)
COPY --from=builder --chown=loocbooc:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=loocbooc:nodejs /app/packages/database/node_modules ./packages/database/node_modules

# Copy root workspace files
COPY --chown=loocbooc:nodejs package.json pnpm-workspace.yaml ./

USER loocbooc

ENV NODE_ENV=production

# Worker process listens to BullMQ queues — no HTTP port exposed
# Health is monitored via process existence and Redis queue metrics

# Start worker
CMD ["node", "apps/worker/dist/index.js"]
