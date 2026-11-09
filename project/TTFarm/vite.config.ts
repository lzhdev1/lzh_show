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
    // 账号与存档接口挂在主站（Next.js）的 /api/ttfarm 下：
    // 开发时把请求透传给同容器里的 Next，生产时前端和 API 同域，都不用配跨域
    proxy: {
      "/api/ttfarm": {
        target: "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
  },
});
