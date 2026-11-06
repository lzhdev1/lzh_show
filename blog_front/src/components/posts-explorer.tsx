"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, FileText, Search } from "lucide-react";
import { notes, type Note } from "@/lib/notes";

const DOT: Record<Note["accent"], string> = {
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  lime: "bg-lime-500",
};

/**
 * 文章页主区：左侧搜索 + 目录（30%），右侧正文（70%）。
 * 搜索对标题 / 摘要 / 标签 / 正文实时过滤；首页便签墙可通过 ?note=<id> 指定初始选中项。
 */
export function PostsExplorer({ initialNoteId }: { initialNoteId?: string }) {
  const t = useTranslations("Posts");
  const fallbackId = notes[0]?.id ?? "";
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    notes.some((n) => n.id === initialNoteId) ? (initialNoteId as string) : fallbackId
  );
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [query]);

  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  // 从首页便签跳进来时，把目录里选中的那一条滚到可视范围
  useEffect(() => {
    if (!initialNoteId) return;
    const timer = window.setTimeout(() => {
      activeRef.current?.scrollIntoView({ block: "nearest" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [initialNoteId]);

  return (
    <div className="grid min-h-[480px] grid-cols-1 gap-5 md:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
      {/* 左栏：搜索 + 目录 */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card/70 backdrop-blur-sm">
        <div className="shrink-0 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
            />
          </div>
        </div>

        <nav className="max-h-64 flex-1 overflow-y-auto p-2 md:max-h-none">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((n) => {
                const active = n.id === selected?.id;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      ref={active ? activeRef : undefined}
                      onClick={() => setSelectedId(n.id)}
                      className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[n.accent]}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block line-clamp-2 leading-snug ${
                            active ? "font-medium" : ""
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {n.updatedAt}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>

      {/* 右栏：正文 */}
      <article className="rounded-xl border bg-card/70 p-6 backdrop-blur-sm">
        {selected ? (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>
                {t("updated")} {selected.updatedAt}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold leading-snug">
              {selected.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-4 border-l-2 border-primary/40 pl-3 text-sm leading-6 text-muted-foreground">
              {selected.summary}
            </p>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {selected.content}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </article>
    </div>
  );
}
