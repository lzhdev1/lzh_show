"use client";

import {
  Children,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// A short viewport can leave part of a section below the fold. Let the
// visitor reach its footer (or scroll back to its heading) before paging.
function hasRoomToScroll(section: HTMLElement, direction: number, startY = window.scrollY) {
  const rect = section.getBoundingClientRect();
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  if (rect.height <= window.innerHeight - margin + 2) return false;
  const top = rect.top + window.scrollY - startY;
  return direction > 0 ? top + rect.height > window.innerHeight + 2 : top < margin - 2;
}

/**
 * 全屏板块翻页容器：将 children 视为多个"板块"，每个板块一屏，
 * 支持滚轮 / 鼠标按住拖动 / 手指滑动双向翻页（上一板块 / 下一板块）。
 *
 * - 滚轮：向下滚 → 下一板块；向上滚 → 上一板块
 * - 鼠标左键按住拖动：向上拖 → 下一板块；向下拖 → 上一板块（页面实时跟随）
 * - 触摸：上滑 → 下一板块；下滑 → 上一板块（兼容原生纵向滚动）
 * - 点击（位移 < 6px）不受影响，正常触发按钮/链接
 * - 翻页动画期间防抖，避免连续触发；首/尾板块边界外不拦截，保留默认滚动
 *
 * 用法：<SectionPager> 内直接放若干 section（每个即一个板块）。
 */
export function SectionPager({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const dragged = useRef(false);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    startScrollY: number;
    startIndex: number;
    moved: boolean;
    pointerType: string;
    horizontalTrack: boolean;
  } | null>(null);

  const sections = () =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-section]") ?? []);

  /** 当前所在板块：以视口 40% 高度处命中的板块判定（板块顶部对齐视口后 scrollY 不能直接比） */
  const currentIndex = () => {
    const list = sections();
    if (list.length === 0) return 0;
    const y = window.scrollY + window.innerHeight * 0.4;
    let idx = 0;
    for (let i = 0; i < list.length; i++) {
      if (y >= list[i].offsetTop) idx = i;
    }
    return idx;
  };

  const goTo = (i: number) => {
    const list = sections();
    if (i < 0 || i >= list.length) return;
    lockRef.current = true;
    list[i].scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      lockRef.current = false;
    }, 900);
  };

  // 滚轮双向翻页；越界时不拦截（保留滚动到页脚/顶部）
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (lockRef.current) return;
      if (e.ctrlKey || (e.target instanceof Element && e.target.closest("[data-horizontal-scroll]") &&
          (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)))) return;
      const list = sections();
      const idx = currentIndex();
      if (list[idx] && hasRoomToScroll(list[idx], e.deltaY)) return;
      let target = -1;
      if (e.deltaY > 0) target = idx + 1;
      else if (e.deltaY < 0) target = idx - 1;
      if (target >= 0 && target < list.length) {
        e.preventDefault();
        goTo(target);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    dragged.current = false;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startScrollY: window.scrollY,
      startIndex: currentIndex(),
      moved: false,
      pointerType: e.pointerType,
      horizontalTrack: e.target instanceof Element && !!e.target.closest("[data-horizontal-scroll]"),
    };
    // 不在按下时就 capture：捕获会把后续 click 的目标重定向到本容器，
    // 导致板块内的链接/按钮点不动。等真正开始拖动后再捕获。
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;
    if (d.horizontalTrack && !d.moved && Math.abs(dx) >= 7 && Math.abs(dx) >= Math.abs(dy)) {
      dragRef.current = null;
      return;
    }
    if (!d.moved && Math.abs(dy) > 6) {
      d.moved = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* 合成事件无 capture，忽略 */
      }
    }
    if (d.moved && d.pointerType === "mouse") {
      // 桌面：页面实时跟随拖动（触摸端交给原生滚动）
      window.scrollTo({ top: d.startScrollY - dy, behavior: "auto" });
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    if (!d.moved) return;

    dragged.current = true;
    const dy = e.clientY - d.startY;
    const section = sections()[d.startIndex];
    if (section && hasRoomToScroll(section, -dy, d.startScrollY)) return;
    if (dy <= -60) {
      goTo(d.startIndex + 1);
    } else if (dy >= 60) {
      goTo(d.startIndex - 1);
    } else if (d.pointerType === "mouse" || window.scrollY === d.startScrollY) {
      // 桌面未过阈值 / 触摸未产生滚动 → 回弹
      window.scrollTo({ top: d.startScrollY, behavior: "smooth" });
    }
    // 触摸轻微滑动：页面保持原生滚动位置，不回弹
  };

  const onPointerCancel = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };

  return (
    <div
      ref={rootRef}
      data-section-pager
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={e => {
        if (dragged.current && e.detail > 0) {
          e.preventDefault();
          e.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      {Children.map(children, (child, i) => (
        <div
          key={i}
          data-section={i}
          className="relative scroll-mt-16"
          // scroll-margin 必须加在翻页目标（本容器）上，导航栏下方避让
        >
          {child}
        </div>
      ))}
    </div>
  );
}
