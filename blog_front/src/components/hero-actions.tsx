"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Hero 操作区：View Projects 平滑滚动到 Featured Projects 板块；
 * About Me 跳转 About 页面。
 */
export function HeroActions() {
  const t = useTranslations("Hero");

  const goToFeatured = () => {
    document
      .querySelector('[data-section="1"]')
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="animate-fade-up flex flex-wrap items-center justify-center gap-4"
      style={{ "--delay": "270ms" } as CSSProperties}
    >
      {/* 主按钮：白色玻璃 + hover 发光 → 滚动到精选作品板块 */}
      <button
        type="button"
        onClick={goToFeatured}
        className="group inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_28px_rgba(255,255,255,0.18)]"
      >
        {t("ctaProjects")}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      </button>
      {/* 次按钮：白描边玻璃 → About 页面 */}
      <Link
        href="/about"
        className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-sm font-semibold text-white transition-colors duration-300 hover:border-white/30 hover:bg-white/5"
      >
        {t("ctaAbout")}
      </Link>
    </div>
  );
}
