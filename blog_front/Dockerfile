# ===== lzh_show 镜像（多阶段构建）=====
# 基础镜像固定 node:20-alpine：服务器上已有该镜像（v20.20.2，满足 Next 16 的 >=20.9 要求），
# 可完全离线构建；Docker Hub 直连在服务器上拉取大层会长时间 0B 卡住。
#
# 构建上下文是仓库根目录：镜像里同时带着主站 blog_front 和游戏 project/TTFarm，
# 两者在同一个容器里跑 —— dev 阶段两个进程各自热更新，prod 阶段游戏构建成静态目录交给 Next 托管。

# ---- 主站依赖 ----
FROM node:20-alpine AS deps
WORKDIR /app
# 服务器直连 registry.npmjs.org 极慢（corepack 下载 pnpm 会卡在 0%），统一走 npmmirror
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com
RUN corepack enable
COPY blog_front/package.json blog_front/pnpm-lock.yaml blog_front/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- 游戏依赖 ----
FROM node:20-alpine AS ttfarm-deps
WORKDIR /ttfarm
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate
COPY project/TTFarm/package.json project/TTFarm/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- 开发阶段：主站 + 游戏同时热更新（同一个容器） ----
FROM node:20-alpine AS dev
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY blog_front/ .
COPY --from=ttfarm-deps /ttfarm/node_modules /ttfarm/node_modules
COPY docker/dev-start.sh /usr/local/bin/dev-start.sh
RUN chmod +x /usr/local/bin/dev-start.sh
EXPOSE 3000 5174
# 主站 3000、游戏 5174，两个进程在同一个容器里
CMD ["/usr/local/bin/dev-start.sh"]

# ---- 构建阶段：先出游戏产物，再出主站产物 ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com \
    npm_config_registry=https://registry.npmmirror.com
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate
COPY blog_front/package.json blog_front/pnpm-lock.yaml blog_front/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY blog_front/ .
WORKDIR /ttfarm
COPY project/TTFarm/package.json project/TTFarm/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY project/TTFarm/ .
RUN pnpm build
# 游戏产物直接落进主站的静态目录，由 Next 的 public 提供 /ttfarm
RUN rm -rf /app/public/ttfarm && cp -r /ttfarm/dist /app/public/ttfarm
WORKDIR /app
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
