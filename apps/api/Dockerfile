# ================================================================
# Loocbooc API — Multi-stage Dockerfile
# ================================================================
# Production build with pnpm monorepo support.
# Stage 1: Install dependencies
# Stage 2: Build TypeScript
# Stage 3: Production image with minimal footprint
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
COPY apps/api/package.json apps/api/package.json

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
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY packages/database ./packages/database
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/config ./packages/config
COPY apps/api ./apps/api
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build packages in order
RUN pnpm --filter @loocbooc/types build || true
RUN pnpm --filter @loocbooc/utils build || true
RUN pnpm --filter @loocbooc/database build || true
RUN pnpm --filter @loocbooc/api build

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
COPY --from=builder --chown=loocbooc:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=loocbooc:nodejs /app/apps/api/package.json ./apps/api/package.json

# Copy node_modules (production only)
COPY --from=builder --chown=loocbooc:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=loocbooc:nodejs /app/packages/database/node_modules ./packages/database/node_modules

# Copy root workspace files
COPY --chown=loocbooc:nodejs package.json pnpm-workspace.yaml ./

USER loocbooc

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start API server
CMD ["node", "apps/api/dist/server.js"]
