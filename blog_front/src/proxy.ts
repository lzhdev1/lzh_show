import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// next-intl 代理：负责语言路由（/zh、/en 前缀）与语言 cookie 记忆
// （Next.js 16 的 proxy 约定，替代已弃用的 middleware）
export default createMiddleware(routing);

export const config = {
  // 匹配根路径与语言前缀路径，排除 _next/_vercel 与带扩展名的静态资源
  matcher: ["/", "/(zh|en)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
