"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * Coverflow 3D 横向画廊：作品单行排列，可左右滑动查看，
 * 滑动到中间的卡片最大、正面朝前，两侧卡片缩小、旋转、淡出。
 *
 * - 鼠标左键按住左右拖 / 手指左右滑：跟手滑动，松手切换焦点
 * - 点击两侧卡片：直接将其设为焦点（不触发卡片内部链接）
 * - 焦点卡片：保留内部链接行为（如跳转详情页）
 * - 键盘方向键：切换焦点
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
  const suppressClickRef = useRef(false);

  // 窗口级监听 handler 需要最新状态，用 ref 兜底
  const stateRef = useRef({ focus, dragDx, dragging });
  stateRef.current = { focus, dragDx, dragging };

  const moveTo = (target: number) => {
    setFocus(Math.max(0, Math.min(count - 1, target)));
  };
  const moveToRef = useRef(moveTo);
  moveToRef.current = moveTo;

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

  /** 结束拖动：归位并决定是否切换焦点 */
  const endDrag = (dx: number) => {
    const d = dragRef.current;
    if (!d) return;
    const moved = d.moved;
    dragRef.current = null;
    setDragging(false);
    setDragDx(0);
    if (!moved) return;
    if (dx <= -60) {
      suppressClickRef.current = true; // 拦截拖动松手误触发的 click
      moveToRef.current(stateRef.current.focus + 1);
    } else if (dx >= 60) {
      suppressClickRef.current = true;
      moveToRef.current(stateRef.current.focus - 1);
    }
  };

  // 窗口级监听 pointer 事件：即使指针移出容器 / capture 失效，松手也必定复位
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.startX;
      if (!d.moved && Math.abs(dx) > 6) d.moved = true;
      setDragDx(dx);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      endDrag(e.clientX - d.startX);
    };
    const onCancel = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      endDrag(0); // 取消：复位不翻页
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    // 区域边界：鼠标左键在画廊上的拖动归画廊（横向滑动），
    // 不再冒泡触发外层 SectionPager 的垂直翻页；非左键、触摸放行
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      e.stopPropagation();
    }
    if (dragRef.current) return; // 已有拖动进行中
    dragRef.current = { id: e.pointerId, startX: e.clientX, moved: false };
    setDragging(true);
  };

  return (
    <div
      className={`relative h-[40rem] w-full select-none overflow-hidden sm:h-[40rem] ${className}`}
      style={{ perspective: 1400, touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
      tabIndex={0}
      aria-label="作品画廊，可左右滑动"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") moveTo(focus - 1);
        if (e.key === "ArrowRight") moveTo(focus + 1);
      }}
      onClickCapture={(e) => {
        // 拖动松手误触的 click：拦截一次
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClickRef.current = false;
        }
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
            className="absolute left-1/2 top-1/2 w-[min(calc(100vw-2rem),38rem)]"
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
    </div>
  );
}
