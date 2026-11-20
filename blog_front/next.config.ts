import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl 插件：默认加载 ./src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async rewrites() {
    return [{
      source: "/aftercare/:path*",
      destination: "http://aftercare-app:8000/aftercare/:path*",
    }];
  },
  // The aftercare tool loop has a 35-second deadline; allow it to return its fallback.
  experimental: { proxyTimeout: 60_000 },
  /* config options here */
  // 生产镜像使用 standalone 最小运行时输出
  output: "standalone",
  // 注意：cacheComponents / partialPrefetching 与 next-intl 的请求上下文（setRequestLocale）
  // 存在冲突，静态预渲染时会拦截请求级数据访问，暂关闭（后续升级 next-intl 后评估是否恢复）
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
