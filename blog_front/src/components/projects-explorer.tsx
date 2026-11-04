"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { projects } from "@/lib/projects";

/**
 * 作品列表：顶部居中实时搜索框，按标题 / 摘要 / 技术栈过滤；
 * 卡片使用紧凑变体（更小更精致），grid 展示。
 */
export function ProjectsExplorer() {
  const locale = useLocale();
  const t = useTranslations("Projects");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title[locale].toLowerCase().includes(q) ||
        p.summary[locale].toLowerCase().includes(q) ||
        p.techStack.some((tech) => tech.toLowerCase().includes(q))
    );
  }, [query, locale]);

  return (
    <div className="w-full px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* 搜索框：位于标题行的中间位置，右侧留白平衡视觉 */}
        <div className="w-full max-w-sm sm:w-72">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-full border bg-card/70 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
            />
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 sm:block" aria-hidden />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("noResults")}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((project) => (
            <ProjectCard key={project.slug} project={project} compact />
          ))}
        </div>
      )}
    </div>
  );
}
