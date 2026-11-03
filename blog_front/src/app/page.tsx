import { redirect } from "next/navigation";

// 兜底重定向：根路径正常情况下由 proxy/middleware 重定向到默认语言（zh）
// 此页面保证 / 路由在静态预渲染时可安全处理
export default function RootRedirect() {
  redirect("/zh");
}
