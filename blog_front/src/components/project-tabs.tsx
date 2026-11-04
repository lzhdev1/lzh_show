"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type DetailRow = { label: string; value: string };
type ChangelogRow = { version: string; date: string; changes: string[] };

/**
 * 详情页内容切换栏：详细介绍 / 更新日志 两个 Tab 切换展示。
 */
export function ProjectTabs({
  details,
  changelog,
}: {
  details: DetailRow[];
  changelog: ChangelogRow[];
}) {
  const t = useTranslations("ProjectDetail");
  const [tab, setTab] = useState<"details" | "changelog">("details");

  const tabBtn = (active: boolean) =>
    cn(
      "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="mt-10">
      {/* Tab 切换栏 */}
      <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => setTab("details")}
          className={tabBtn(tab === "details")}
        >
          {t("detailsTitle")}
        </button>
        <button
          type="button"
          onClick={() => setTab("changelog")}
          className={tabBtn(tab === "changelog")}
        >
          {t("changelogTitle")}
        </button>
      </div>

      {/* 面板 */}
      <div className="mt-4 rounded-xl border bg-card/50 p-5">
        {tab === "details" ? (
          <dl className="divide-y">
            {details.map((d) => (
              <div
                key={d.label}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-6"
              >
                <dt className="w-36 shrink-0 font-medium sm:w-40">{d.label}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="divide-y">
            {changelog.map((c) => (
              <div key={c.version} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium">{c.version}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.date}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {c.changes.map((ch, i) => (
                    <li key={i}>· {ch}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
