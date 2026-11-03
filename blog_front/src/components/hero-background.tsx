"use client";

import { useEffect, useRef } from "react";

/**
 * Hero 区银河视频背景。
 * muted + autoplay + playsInline 为标准自动播放条件；
 * 额外提供 JS 播放兜底，避免个别浏览器/环境策略下视频不播放。
 */
export function HeroBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      const p = video.play();
      if (p) p.catch(() => {});
    };

    // 初次挂载即尝试播放；页面隐藏/恢复、窗口重新聚焦时再尝试。
    tryPlay();
    const onVisibility = () => {
      if (!document.hidden) tryPlay();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      className="pointer-events-none absolute inset-0 h-full w-full scale-[0.88] object-contain"
      aria-hidden
    >
      <source src="/videos/galaxy.mp4" type="video/mp4" />
    </video>
  );
}
