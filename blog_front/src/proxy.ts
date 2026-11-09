import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// next-intl 代理：负责语言路由（/zh、/en 前缀）与语言 cookie 记忆
// （Next.js 16 的 proxy 约定，替代已弃用的 middleware）
const intlMiddleware = createMiddleware(routing);

// 作品子路径 /ttfarm/：静态游戏产物放在 public/ttfarm/，
// 这类路径不参与语言路由，直接改写到游戏入口 index.html
const STATIC_WORK_ENTRIES: Record<string, string> = {
  "/ttfarm": "/ttfarm/index.html",
  "/ttfarm/": "/ttfarm/index.html",
};

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // 接口路由不参与语言路由：/api/ttfarm/* 是游戏的后端，直接交给 route handler
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const entry = STATIC_WORK_ENTRIES[pathname];
  if (entry) {
    const url = request.nextUrl.clone();
    url.pathname = entry;
    return NextResponse.rewrite(url);
  }
  return intlMiddleware(request);
}

export const config = {
  // 匹配根路径与语言前缀路径，排除 _next/_vercel、/api 与带扩展名的静态资源
  matcher: ["/", "/(zh|en)/:path*", "/((?!_next|_vercel|api|.*\\..*).*)"],
};
