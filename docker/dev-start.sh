#!/bin/sh
set -eu

# 同一个容器里同时跑主站和游戏：
#   主站 Next.js  :3000（webpack 模式，Windows 挂载卷下靠 WATCHPACK_POLLING 轮询热更新）
#   游戏 Vite     :5174（server.watch.usePolling 打开，同样适配挂载卷）
cd /app
pnpm dev --webpack &
NEXT_PID=$!

cd /ttfarm
pnpm dev &
VITE_PID=$!

# docker stop 时把两个进程一起收掉，避免残留孤儿进程
trap 'kill -TERM "$NEXT_PID" "$VITE_PID" 2>/dev/null || true' TERM INT

# 任意一个进程退出，容器随之退出并由 restart 策略重启
wait
