import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 部署在 https://lzhshow.top/ttfarm/，nginx 透传前缀
  base: "/ttfarm/",
  plugins: [react()],
  server: {
    port: 5174,
    host: "0.0.0.0",
    // 跑在容器里、源码走 Windows 挂载卷时收不到 inotify 事件，改用轮询
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
  },
});
