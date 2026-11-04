"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const CARD_OFFSET = 0.6; // 相邻卡片中心间距 = 卡宽 * 0.6（与 translateX d*60% 对应）
const MIN_SCALE = 0.55;
const SCALE_STEP = 0.14;
const ROTATE_STEP = 26;
const MIN_OPACITY = 0.1;
const OPACITY_STEP = 0.32;

/**
 * Coverflow 3D 横向画廊：作品单行排列，可左右滑动查看，
 * 滑动到中间的卡片最大、正面朝前，两侧卡片缩小、旋转、淡出。
 *
 * 拖拽跟手采用"连续焦点"驱动：按住卡片滑动时，按拖拽位移实时计算一个
 * 浮点焦点位置，每张卡都按它到该位置的距离取姿态——被拖的卡片跟随鼠标移动，
 * 相邻卡片同步缩放/旋转过渡；松手后平滑吸附到最近的整数焦点。
 *
 * - 鼠标左键按住左右拖 / 手指左右滑：卡片跟手滑动，松手吸附切换焦点
 * - 点击两侧卡片：直接将其设为焦点（不触发卡片内部链接）
 * - 焦点卡片：保留内部链接行为（如跳转详情页）
 * - 键盘方向键：切换焦点
 * - 区域边界：鼠标左键在画廊上的拖动归画廊（stopPropagation），
 *   不与外层全屏翻页组件（SectionPager）的垂直翻页冲突；滚轮翻板块不受影响
 * - 垂直滚动不受影响（touch-action: pan-y）
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
  const [focus, setFocus] = useState(0); // 整数焦点（松手后的吸附落点）
  const [dragDx, setDragDx] = useState(0); // 拖动中跟手位移（像素），驱动连续焦点
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startFocus: number;
    gap: number; // 相邻卡片中心距（像素），拖动开始时实测缓存
    dx: number; // 当前位移（pointermove 高频写入，rAF 节流读取）
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  // 拖动跟手渲染节流（约 60Hz），避免 pointermove 高频触发 React 重渲染
  const lastRenderRef = useRef(0);

  const clamp = (v: number) => Math.max(0, Math.min(count - 1, v));

  /** 每张卡根据与当前焦点位置（含拖动偏移）的浮点距离计算 3D 姿态 */
  const cardStyle = (i: number): CSSProperties => {
    const drag = dragRef.current;
    const gap = drag?.gap ?? 1;
    const virtualFocus = focus - (drag ? dragDx : 0) / gap;
    const d = i - virtualFocus;
    const abs = Math.abs(d);
    const scale = Math.max(MIN_SCALE, 1 - abs * SCALE_STEP);
    const opacity = Math.max(MIN_OPACITY, 1 - abs * OPACITY_STEP);
    return {
      zIndex: 100 - Math.round(abs),
      opacity,
      transform: `translate(-50%, -50%) translateX(${d * 100 * CARD_OFFSET}%) scale(${scale}) rotateY(${d * ROTATE_STEP}deg)`,
      transition: dragging
        ? "none"
        : "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease",
    };
  };

  // 窗口级监听 pointer 事件：即使指针移出容器 / capture 失效，松手也必定复位
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.startX;
      if (!d.moved && Math.abs(dx) > 6) d.moved = true;
      // 限制拖拽范围：最多偏移一个卡位（±gap），卡片跟手到头即停，
      // 不会把整排卡片拖出视窗（虚拟焦点被限制在 [startFocus-1, startFocus+1]）
      const gap = d.gap || 1;
      const clamped = Math.max(-gap, Math.min(gap, dx));
      d.dx = clamped;
      // 约 60Hz 节流驱动卡片跟手（pointermove 频率可远超帧率）
      const now = performance.now();
      if (now - lastRenderRef.current >= 16) {
        lastRenderRef.current = now;
        setDragDx(clamped);
      }
    };
    const endDrag = (e: PointerEvent, cancelled: boolean) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = d.dx; // 已按 ±gap 限制的位移，用于吸附判定
      dragRef.current = null;
      setDragging(false);
      setDragDx(0);
      if (!d.moved || cancelled) return; // 点击（无位移）/ 取消：不切换焦点
      // 拖动过：吸附到最近的整数焦点（按位移换算卡位），并拦截拖动后的误触点击
      suppressClickRef.current = true;
      const gap = d.gap || 1;
      setFocus(clamp(Math.round(d.startFocus - dx / gap)));
    };
    const onUp = (e: PointerEvent) => endDrag(e, false);
    const onCancel = (e: PointerEvent) => endDrag(e, true);
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

  // 拖动中：直接由 window 级 onMove 以约 60Hz 节流更新 dragDx 驱动卡片姿态（见上），
  // 松手后 setFocus 吸附，transition 恢复做平滑归位动画

  const moveTo = (target: number) => {
    setFocus(clamp(target));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // 区域边界：鼠标左键在画廊上的拖动归画廊（横向滑动），
    // 不再冒泡触发外层 SectionPager 的垂直翻页；非左键、触摸放行
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      e.stopPropagation();
    }
    if (dragRef.current) return; // 已有拖动进行中
    // 实测相邻卡片中心距（卡宽 * 0.6），供拖拽位移换算为"卡位"
    const card = stageRef.current?.querySelector<HTMLElement>("[data-card]");
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startFocus: focus,
      gap: card ? card.offsetWidth * CARD_OFFSET : 0,
      dx: 0,
      moved: false,
    };
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
      <div ref={stageRef} className="relative h-full w-full">
        {items.map((item, i) => (
          <div
            key={i}
            data-card={i}
            className="absolute left-1/2 top-1/2 w-[min(calc(100vw-2rem),38rem)] will-change-transform"
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
