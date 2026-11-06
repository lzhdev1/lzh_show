# ===== lzh_show 前端镜像（多阶段构建） =====
# 基础镜像固定 node:20-alpine：服务器上已有该镜像（v20.20.2，满足 Next 16 的 >=20.9 要求），
# 可完全离线构建；Docker Hub 直连在服务器上拉取大层会长时间 0B 卡住。

# ---- 依赖安装阶段 ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- 开发阶段：热更新 ----
FROM node:20-alpine AS dev
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# 使用 webpack 模式：Windows bind mount 下 Turbopack 收不到文件事件，
# webpack + WATCHPACK_POLLING 轮询可保证热更新可靠
CMD ["pnpm", "dev", "--webpack"]

# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- 生产运行阶段：standalone 最小运行时 ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 以非 root 用户运行
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
