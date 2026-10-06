# Multi-stage production Dockerfile for @homeexpense/api
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@12.3.4

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @homeexpense/types run build
RUN pnpm --filter @homeexpense/financial-core run build
RUN pnpm --filter @homeexpense/validation run build
RUN pnpm --filter @homeexpense/config run build
RUN pnpm --filter @homeexpense/database run prisma:generate
RUN pnpm --filter @homeexpense/database run build
RUN pnpm --filter @homeexpense/api run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json

USER nestjs
EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
