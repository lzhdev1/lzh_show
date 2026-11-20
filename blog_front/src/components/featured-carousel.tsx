"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

type Slide = { slug: string; title: string; content: ReactNode };

function slideStride(track: HTMLDivElement) {
  const [first, second] = track.children;
  return first instanceof HTMLElement && second instanceof HTMLElement
    ? second.offsetLeft - first.offsetLeft
    : track.clientWidth;
}

function nearestSlide(track: HTMLDivElement) {
  const stride = slideStride(track);
  const index = stride > 0 ? Math.round(track.scrollLeft / stride) : 0;
  return Math.max(0, Math.min(index, track.children.length - 1));
}

export function FeaturedCarousel({ items }: { items: Slide[] }) {
  const t = useTranslations("Home");
  const trackRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const destination = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    scrollLeft: number;
    startIndex: number;
    engaged: boolean;
  } | null>(null);
  const count = items.length;
  const active = Math.min(selected, count - 1);

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track || !count) return;
    const next = Math.max(0, Math.min(index, count - 1));
    const left = next * slideStride(track);
    destination.current = Math.abs(track.scrollLeft - left) > 1 ? next : null;
    setSelected(next);
    track.scrollTo({
      left,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  function syncSelection(track: HTMLDivElement) {
    if (destination.current !== null) {
      // A smooth jump may cross several slides before reaching the requested one.
      if (Math.abs(track.scrollLeft - destination.current * slideStride(track)) > 1) return;
      destination.current = null;
    }
    setSelected(nearestSlide(track));
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // CSS scroll snap keeps the same item aligned after resizing. A pending
    // button jump, however, must use the destination's new pixel offset.
    let width = track.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === track.clientWidth) return;
      width = track.clientWidth;
      if (destination.current !== null) {
        track.scrollTo({ left: destination.current * slideStride(track), behavior: "instant" });
      }
      syncSelection(track);
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [count]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    destination.current = null;
    if (count < 2 || event.pointerType !== "mouse" || event.button !== 0) return;
    const track = event.currentTarget;
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      scrollLeft: track.scrollLeft, startIndex: nearestSlide(track), engaged: false,
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const track = event.currentTarget;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.engaged) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      state.engaged = true;
      track.setPointerCapture(event.pointerId);
      track.dataset.dragging = "";
      track.style.scrollSnapType = "none";
    }
    track.scrollLeft = state.scrollLeft - dx;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    if (!state.engaged) return;
    const track = event.currentTarget;
    const dx = state.x - event.clientX;
    let target = nearestSlide(track);
    if (event.type === "pointerup" && target === state.startIndex &&
        Math.abs(dx) >= Math.min(72, track.clientWidth * 0.18)) {
      target += Math.sign(dx);
    }
    suppressClick.current = true;
    delete track.dataset.dragging;
    track.style.removeProperty("scroll-snap-type");
    goTo(target);
  }

  if (!count) return null;
  return (
    <div className="featured-carousel" role="region" aria-label={t("featuredTitle")}
      onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || count < 2) return;
        const current = destination.current ?? active;
        let target: number;
        switch (event.key) {
          case "ArrowLeft": target = current - 1; break;
          case "ArrowRight": target = current + 1; break;
          case "Home": target = 0; break;
          case "End": target = count - 1; break;
          default: return;
        }
        event.preventDefault();
        trackRef.current?.focus({ preventScroll: true });
        goTo(target);
      }}>
      <div ref={trackRef} className="featured-track" data-horizontal-scroll tabIndex={count > 1 ? 0 : undefined}
        onScroll={event => syncSelection(event.currentTarget)}
        onWheel={() => { destination.current = null; }}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
        onPointerCancel={endDrag} onLostPointerCapture={endDrag}
        onPointerLeave={() => { if (!drag.current?.engaged) drag.current = null; }}
        onDragStart={event => event.preventDefault()}
        onClickCapture={event => {
          if (suppressClick.current && event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}>
        {items.map((item, index) => (
          <div key={item.slug} className="featured-slide" inert={index !== active}>
            {item.content}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="featured-controls">
          <div className="featured-pagination">
            {items.map((item, index) => (
              <button key={item.slug} type="button" title={item.title} aria-current={index === active || undefined}
                aria-label={t("goToProject", { title: item.title })} onClick={() => goTo(index)} />
            ))}
          </div>
          <div className="featured-steering">
            <span className="featured-count" role="status" aria-atomic="true">
              <span aria-hidden="true">{String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
              <span className="sr-only">{t("projectPosition", { current: active + 1, total: count })}</span>
            </span>
            <button className="featured-arrow" type="button" aria-label={t("previousProject")} disabled={active === 0}
              onClick={() => goTo((destination.current ?? active) - 1)}><ChevronLeft aria-hidden="true" /></button>
            <button className="featured-arrow" type="button" aria-label={t("nextProject")} disabled={active === count - 1}
              onClick={() => goTo((destination.current ?? active) + 1)}><ChevronRight aria-hidden="true" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
