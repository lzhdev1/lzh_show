"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Search } from "lucide-react";
import { notes } from "@/lib/notes";

/**
 * 笔记板块：左侧 30% 为搜索 + 笔记目录，右侧 70% 展示选中笔记内容。
 * 搜索为实时过滤（标题 / 内容命中即显示）。
 */
export function NotesSection() {
  const t = useTranslations("Home");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }, [query]);

  const selected =
    notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6 shrink-0">
        <h2 className="text-2xl font-bold">{t("notesTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("notesSubtitle")}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 md:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
        {/* 左栏：搜索 + 目录 */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card/70 backdrop-blur-sm">
          <div className="shrink-0 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("notesSearchPlaceholder")}
                className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
              />
            </div>
          </div>
          <nav className="max-h-60 flex-1 overflow-y-auto p-2 md:max-h-none">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t("notesEmpty")}</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((n) => {
                  const active = n.id === selected?.id;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(n.id)}
                        className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="line-clamp-2">{n.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </aside>

        {/* 右栏：笔记内容 */}
        <article className="min-h-0 overflow-y-auto rounded-xl border bg-card/70 p-6 backdrop-blur-sm">
          {selected ? (
            <>
              <h3 className="text-xl font-bold">{selected.title}</h3>
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
              <p className="mt-2 text-xs text-muted-foreground">
                {t("notesUpdated")} {selected.updatedAt}
              </p>
              <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                {selected.content}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("notesEmpty")}</p>
          )}
        </article>
      </div>
    </div>
  );
}
