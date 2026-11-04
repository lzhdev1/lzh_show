"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * 拖拽翻页容器：在区域内按住（鼠标左键 / 手指）向上拖过阈值后，
 * 平滑滚入 `#targetId` 区域；未过阈值则回弹到起点。
 * - 桌面鼠标：按住左键向上拖动，页面实时跟随，松手判定
 * - 触摸：兼容原生纵向滚动，手指上划超过阈值触发翻页
 * - 滚轮：向下滚动一格直接翻入目标区域（动画期间防抖）
 * - 点击（位移 < 6px）不受影响，正常触发按钮/链接
 */
export function DragToScroll({
  targetId,
  threshold = 60,
  className = "",
  children,
}: {
  targetId: string;
  threshold?: number;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number;
    startY: number;
    startScrollY: number;
    moved: boolean;
    pointerType: string;
  } | null>(null);

  const suppressNextClick = () => {
    const suppress = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      window.removeEventListener("click", suppress, true);
    };
    window.addEventListener("click", suppress, true);
  };

  const endDrag = (d: NonNullable<typeof dragRef.current>) => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // 鼠标仅接受左键
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      id: e.pointerId,
      startY: e.clientY,
      startScrollY: window.scrollY,
      moved: false,
      pointerType: e.pointerType,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件无 capture，忽略 */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) > 6) {
      d.moved = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
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
    endDrag(d);
    if (!d.moved) return;

    suppressNextClick();
    const target = document.getElementById(targetId);
    if (!target) return;

    const dy = e.clientY - d.startY;
    if (dy <= -threshold) {
      // 向上拖过阈值 → 平滑进入目标区域
      target.scrollIntoView({ behavior: "smooth", block: "start" });
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
    endDrag(d);
  };

  // 滚轮翻页：区域内向下滚动一格 → 平滑进入目标区域；动画期间防抖
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    let locked = false;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0) return; // 向上滚动不拦截
      if (locked) return;
      const rect = target.getBoundingClientRect();
      // 已进入目标区域（顶部进入视口 30% 内）不再重复翻页
      if (rect.top <= window.innerHeight * 0.3) return;
      e.preventDefault();
      locked = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        locked = false;
      }, 900);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [targetId]);

  return (
    <div
      ref={rootRef}
      data-drag-scroll
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ touchAction: "pan-y" }}
    >
      {children}
    </div>
  );
}
