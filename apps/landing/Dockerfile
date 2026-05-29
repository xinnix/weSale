FROM node:20-alpine AS builder
RUN npm config set registry https://registry.npmmirror.com
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json ./apps/landing/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/landing/ ./apps/landing/
RUN pnpm --filter landing build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public
EXPOSE 3001
ENV PORT=3001
CMD ["node", "apps/landing/server.js"]
