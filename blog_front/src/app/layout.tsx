import "./globals.css";

// 根布局仅转发 children，html/body 由 [locale]/layout.tsx 渲染（next-intl 官方结构）
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
