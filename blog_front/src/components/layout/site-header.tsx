"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import ThemeToggle from "@/components/theme-toggle";

const navItems = [
  { href: "/", key: "home" },
  { href: "/projects", key: "projects" },
  { href: "/posts", key: "posts" },
  { href: "/about", key: "about" },
] as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6">
        {/* 品牌 */}
        <Link href="/" className="text-lg font-bold tracking-tight">
          LZH<span className="text-primary">.</span>show
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navItems.map((item) => (
            <Link key={item.key} href={item.href} className={linkClass(item.href)}>
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* 右侧工具区 */}
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          {/* 移动端菜单开关 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {mobileOpen && (
        <nav
          className="border-t bg-background md:hidden"
          aria-label="Mobile"
          onClick={() => setMobileOpen(false)}
        >
          <div className="flex w-full flex-col gap-1 px-4 py-3 sm:px-6">
            {navItems.map((item) => (
              <Link key={item.key} href={item.href} className={linkClass(item.href)}>
                {t(item.key)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
