"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 滚动入场容器：元素进入视口后自下而上滑入 + 淡入，只触发一次。
 * 未进入视口时保持 translate-y-6 + opacity-0（避免后台标签页预渲染闪烁）。
 *
 * 触发三保险：IntersectionObserver + scroll/resize 监听 + rAF 轮询兜底，
 * 确保任何环境（含自动化浏览器合成滚动、IO 回调不派发）都能正常入场。
 */
export function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      setVisible(true);
    };
    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const check = () => {
      if (!el || shownRef.current) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // 顶部进入视口 92% 内或底部已露出即视为可见
      if (r.top < vh * 0.92 && r.bottom > 0) {
        show();
        cleanup();
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show();
            cleanup();
            break;
          }
        }
      },
      // 进入视口 15% 即触发；底部预留 8% 视差提前量
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    let rafId = 0;
    const loop = () => {
      check();
      if (!shownRef.current) rafId = requestAnimationFrame(loop);
    };
    const cleanup = () => {
      io.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      cancelAnimationFrame(rafId);
    };

    io.observe(el);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    rafId = requestAnimationFrame(loop);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
