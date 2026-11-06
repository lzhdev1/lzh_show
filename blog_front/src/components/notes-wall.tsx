"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notes, type Note } from "@/lib/notes";

/** 胶带颜色（按文章 accent 取，静态类名，避免运行时拼接） */
const TAPE: Record<Note["accent"], string> = {
  teal: "bg-teal-400/50 dark:bg-teal-300/45",
  violet: "bg-violet-400/50 dark:bg-violet-300/45",
  amber: "bg-amber-400/55 dark:bg-amber-300/45",
  sky: "bg-sky-400/50 dark:bg-sky-300/45",
  rose: "bg-rose-400/50 dark:bg-rose-300/45",
  lime: "bg-lime-400/50 dark:bg-lime-300/45",
};

const DOT: Record<Note["accent"], string> = {
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  lime: "bg-lime-500",
};

type Card = {
  note: Note;
  tilt: number;
  duration: number;
  delay: number;
};

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 每次进入页面随机抽几篇：洗牌 + 每张卡独立的倾斜角、浮动周期与相位，
 * 让便签看起来是"随手贴上去、各自轻轻晃"的。
 */
function buildCards(): Card[] {
  return shuffle(notes)
    .slice(0, 6)
    .map((note) => ({
      note,
      tilt: -3.2 + Math.random() * 6.4,
      duration: 11 + Math.random() * 8,
      delay: -Math.random() * 14,
    }));
}

/**
 * 首页"最新文章"：便签墙。
 * 六张便签分三列错落贴放，各自做极轻的浮动动画；悬停抬起并露出"阅读全文"，
 * 点击跳转到文章页并定位到该篇（/posts?note=<id>）。
 */
export function NotesWall() {
  const [cards, setCards] = useState<Card[] | null>(null);

  // 洗牌与随机相位必须在挂载后计算：服务端渲染时若随机，会和客户端水合结果不一致。
  // 这里同步置位是有意为之，rAF/定时器在后台标签页会被节流导致卡片一直不出现。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCards(buildCards());
  }, []);

  if (!cards) {
    return <div className="min-h-[360px] sm:min-h-[420px]" aria-hidden />;
  }

  const columns = [cards.slice(0, 2), cards.slice(2, 4), cards.slice(4, 6)];

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start lg:gap-6">
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className={`${
            columnIndex === 2 ? "hidden lg:flex" : "flex"
          } flex-1 flex-col gap-5 ${
            columnIndex === 1 ? "md:mt-8" : columnIndex === 2 ? "md:mt-3" : ""
          }`}
        >
          {column.map((card, cardIndex) => (
            <div
              key={card.note.id}
              className={`animate-notes-float ${
                cardIndex === 1 ? "hidden sm:block" : ""
              }`}
              style={
                {
                  "--tilt": `${card.tilt.toFixed(2)}deg`,
                  "--float-duration": `${card.duration.toFixed(1)}s`,
                  "--float-delay": `${card.delay.toFixed(1)}s`,
                } as CSSProperties
              }
            >
              <Link
                href={`/posts?note=${card.note.id}`}
                className="group relative block"
              >
                {/* 和纸胶带 */}
                <span
                  aria-hidden
                  className={`absolute -top-2 left-1/2 z-10 h-4 w-14 -translate-x-1/2 -rotate-3 rounded-[3px] ${TAPE[card.note.accent]} shadow-sm`}
                />
                <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_32px_-24px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_26px_50px_-26px_rgba(0,0,0,0.42)] dark:border-white/10">
                  {/* 纸面颗粒 */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.035)_1px,transparent_0)] bg-[length:5px_5px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.045)_1px,transparent_0)]"
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[card.note.accent]}`}
                        aria-hidden
                      />
                      <span className="truncate">{card.note.tags[0]}</span>
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {card.note.updatedAt}
                      </span>
                    </div>

                    <h3 className="mt-2.5 text-base font-bold leading-snug transition-colors group-hover:text-primary">
                      {card.note.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {card.note.summary}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {card.note.tags.slice(1, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
