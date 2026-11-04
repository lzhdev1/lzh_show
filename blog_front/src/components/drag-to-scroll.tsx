"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * 拖拽翻页容器：在区域内按住（鼠标左键 / 手指）向上拖过阈值后，
 * 平滑滚入 `#targetId` 区域；未过阈值则回弹到起点。
 * - 桌面鼠标：按住左键向上拖动，页面实时跟随，松手判定
 * - 触摸：兼容原生纵向滚动，手指上划超过阈值触发翻页
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

  return (
    <div
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
