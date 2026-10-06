# Multi-stage production Dockerfile for @homeexpense/web
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@12.3.4

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeexpense/types run build
RUN pnpm --filter @homeexpense/financial-core run build
RUN pnpm --filter @homeexpense/validation run build
RUN pnpm --filter @homeexpense/config run build
RUN pnpm --filter @homeexpense/ui run build
RUN pnpm --filter @homeexpense/shared run build
RUN pnpm --filter @homeexpense/web run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json

USER nextjs
EXPOSE 3000
CMD ["pnpm", "--filter", "@homeexpense/web", "run", "start"]
