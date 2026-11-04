"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Coverflow 3D 横向画廊：作品单行排列，可左右滑动查看，
 * 滑动到中间的卡片最大、正面朝前，两侧卡片缩小、旋转、淡出。
 *
 * - 鼠标左键按住左右拖 / 手指左右滑：跟手滑动，松手切换焦点
 * - 点击两侧卡片：直接将其设为焦点（不触发卡片内部链接）
 * - 焦点卡片：保留内部链接行为（如跳转详情页）
 * - 左右箭头按钮 / 键盘方向键：切换焦点
 * - 垂直滚动不受影响（touch-action: pan-y），与全屏板块翻页共存
 *
 * 用法：<Carousel3D items={[<CardA/>, <CardB/>, ...]} />
 */
export function Carousel3D({
  items,
  className = "",
}: {
  items: ReactNode[];
  className?: string;
}) {
  const count = items.length;
  const [focus, setFocus] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: number; startX: number; moved: boolean } | null>(
    null,
  );

  /** 每张卡根据与焦点的距离计算 3D 姿态 */
  const cardStyle = (i: number): CSSProperties => {
    const d = i - focus;
    const abs = Math.abs(d);
    const scale = Math.max(0.55, 1 - abs * 0.14);
    const translateX = d * 60; // 相对卡片自身宽度
    const rotateY = d * 26;
    const opacity = Math.max(0.1, 1 - abs * 0.32);
    return {
      zIndex: 100 - abs,
      opacity,
      transform: `translate(-50%, -50%) translateX(${translateX}%) scale(${scale}) rotateY(${rotateY}deg)`,
      transition: dragging
        ? "none"
        : "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease",
    };
  };

  const moveTo = (target: number) => {
    setFocus(Math.max(0, Math.min(count - 1, target)));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { id: e.pointerId, startX: e.clientX, moved: false };
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件无 capture，忽略 */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) d.moved = true;
    setDragDx(dx);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const moved = d.moved;
    dragRef.current = null;
    setDragging(false);
    setDragDx(0);
    if (!moved) return;
    // 横向滑动切换焦点
    if (dx <= -60) moveTo(focus + 1);
    else if (dx >= 60) moveTo(focus - 1);
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    setDragging(false);
    setDragDx(0);
  };

  return (
    <div
      className={`relative h-[30rem] select-none overflow-hidden sm:h-[32rem] ${className}`}
      style={{ perspective: 1400, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      tabIndex={0}
      aria-label="作品画廊，可左右滑动"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") moveTo(focus - 1);
        if (e.key === "ArrowRight") moveTo(focus + 1);
      }}
    >
      {/* 卡片舞台：跟手平移；松手后平滑归位 */}
      <div
        className="relative h-full w-full"
        style={{
          transform: `translateX(${dragDx}px)`,
          transition: dragging
            ? "none"
            : "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-[min(80vw,24rem)]"
            style={cardStyle(i)}
            onClickCapture={(e) => {
              // 侧卡点击：聚焦而非触发内部链接；焦点卡保留链接行为
              if (i !== focus) {
                e.preventDefault();
                e.stopPropagation();
                moveTo(i);
              }
            }}
          >
            {item}
          </div>
        ))}
      </div>

      {/* 左右切换按钮 */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张"
            onClick={() => moveTo(focus - 1)}
            className="absolute left-3 top-1/2 z-[200] -translate-y-1/2 rounded-full border bg-background/60 p-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/80 hover:text-foreground disabled:opacity-30"
            disabled={focus === 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={() => moveTo(focus + 1)}
            className="absolute right-3 top-1/2 z-[200] -translate-y-1/2 rounded-full border bg-background/60 p-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/80 hover:text-foreground disabled:opacity-30"
            disabled={focus === count - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
