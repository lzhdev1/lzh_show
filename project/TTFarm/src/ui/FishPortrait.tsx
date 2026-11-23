import { useId } from "react";
import type { FishSpecies } from "../game/fish";

function hex(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

export function FishPortrait({ fish, size = 120, dim = false }: { fish: FishSpecies; size?: number; dim?: boolean }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const { visual } = fish;
  const primary = hex(visual.primary), secondary = hex(visual.secondary), belly = hex(visual.belly);
  const fin = hex(visual.fin), accent = hex(visual.accent), eye = hex(visual.eye);
  const girth = Math.min(1.25, Math.max(0.65, visual.girth / 0.26));
  const idBody = `fb${uid}`, idFin = `ff${uid}`, idGlow = `fg${uid}`, clip = `fc${uid}`;
  const slow = visual.body === "eel" || visual.body === "slender";
  const tail = visual.tail;
  const bodyPath = slow
    ? "M136 45 C126 31 98 28 64 32 C45 35 30 40 22 45 C30 50 45 55 64 58 C98 62 126 59 136 45 Z"
    : "M136 45 C130 23 106 14 76 18 C52 21 37 29 29 45 C37 61 52 69 76 72 C106 76 130 67 136 45 Z";
  const tailPath = tail === "fork"
    ? "M29 45 C19 42 8 34 4 22 C3 19 8 18 12 22 C18 30 23 36 32 43 L32 47 C23 54 18 60 12 68 C8 72 3 71 4 68 C8 56 19 48 29 45 Z"
    : tail === "ribbon"
      ? "M31 45 C18 38 4 34 2 26 C0 20 3 17 7 21 C14 29 21 36 32 43 L32 47 C21 54 14 61 7 69 C3 73 0 70 2 64 C4 56 18 52 31 45 Z"
      : tail === "crescent"
        ? "M30 45 C18 43 6 30 4 16 C3 11 7 9 11 13 C19 24 25 34 33 42 L32 48 C22 54 15 61 10 70 C6 76 2 73 4 66 C9 55 19 48 30 45 Z"
        : tail === "round"
          ? "M30 45 C20 40 12 32 12 24 C12 18 16 16 20 20 C25 28 28 36 33 43 L33 47 C28 54 25 62 20 70 C16 74 12 72 12 66 C12 58 20 50 30 45 Z"
          : "M30 45 C18 40 7 30 6 20 C5 15 10 14 14 19 C20 28 25 36 33 43 L33 47 C25 54 20 62 14 71 C10 76 5 75 6 70 C7 60 18 50 30 45 Z";

  return <svg className="fish-portrait" viewBox="0 0 150 90" width={size} height={size * 0.6}
    role="img" aria-label={fish.name} style={{ opacity: dim ? 0.38 : 1, filter: dim ? "grayscale(.65)" : undefined }}>
    <defs>
      <linearGradient id={idBody} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={primary} />
        <stop offset=".48" stopColor={secondary} />
        <stop offset="1" stopColor={belly} />
      </linearGradient>
      <linearGradient id={idFin} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={fin} />
        <stop offset="1" stopColor={accent} />
      </linearGradient>
      <radialGradient id={idGlow}>
        <stop offset="0" stopColor={accent} stopOpacity=".65" />
        <stop offset="1" stopColor={accent} stopOpacity="0" />
      </radialGradient>
      <clipPath id={clip}><path d={bodyPath} /></clipPath>
      {visual.glow ? <filter id={`soft${uid}`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter> : null}
    </defs>
    {visual.glow ? <ellipse cx="78" cy="46" rx="66" ry="30" fill={`url(#${idGlow})`} opacity={Math.min(0.7, visual.glow)} /> : null}
    <g transform={`translate(0 ${45 - 45 * girth}) scale(1 ${girth}) translate(0 ${45 / girth - 45})`} filter={visual.glow ? `url(#soft${uid})` : undefined}>
      <path d={tailPath} fill={`url(#${idFin})`} stroke={fin} strokeWidth=".8" opacity=".92" />
      <path d="M94 25 L104 8 L110 27 Z" fill={fin} opacity=".8" />
      <path d="M84 65 L94 82 L72 70 Z" fill={fin} opacity=".6" />
      <path d="M102 31 L120 25 L110 40 Z" fill={accent} opacity=".66" />
      <path d={bodyPath} fill={`url(#${idBody})`} stroke={secondary} strokeWidth="1.1" />
      <g clipPath={`url(#${clip})`}>
        {visual.pattern === "stripe" ? Array.from({ length: 6 }, (_, i) =>
          <path key={i} d={`M${54 + i * 13} 6 L${58 + i * 13} 84`} stroke={accent} strokeWidth="5" opacity=".33" />) : null}
        {visual.pattern === "spot" ? Array.from({ length: 11 }, (_, i) =>
          <circle key={i} cx={48 + (i % 5) * 18 + (i > 5 ? 7 : 0)} cy={26 + (i % 3) * 17} r={4.2 + (i % 3)}
            fill={accent} opacity=".5" />) : null}
        {visual.pattern === "patch" ? <>
          <ellipse cx="74" cy="32" rx="20" ry="14" fill={accent} opacity=".48" transform="rotate(-14 74 32)" />
          <ellipse cx="113" cy="55" rx="14" ry="10" fill={accent} opacity=".42" transform="rotate(12 113 55)" />
          <ellipse cx="48" cy="57" rx="12" ry="9" fill={secondary} opacity=".48" />
        </> : null}
        {visual.pattern === "scale" ? Array.from({ length: 5 }, (_, row) => Array.from({ length: 8 }, (_, col) =>
          <path key={`${row}-${col}`} d={`M${50 + col * 12 + row * 3} ${24 + row * 12} l8 -7 l8 7 l-8 7 Z`}
            fill="none" stroke={accent} strokeWidth=".7" opacity=".28" />)) : null}
        {visual.pattern === "glow" ? Array.from({ length: 9 }, (_, i) =>
          <circle key={i} cx={46 + (i * 11) % 84} cy={24 + (i * 17) % 42} r="1.6" fill="#ffffff" opacity=".75" />) : null}
      </g>
      <circle cx="119" cy="39" r="4.6" fill="#f7f7ed" />
      <circle cx="120" cy="39" r="2.7" fill={eye} />
      <circle cx="121" cy="38" r="1" fill="#ffffff" />
      {visual.whiskers ? <>
        <path d="M133 51 C140 55 143 66 138 72" stroke={secondary} strokeWidth="1.5" fill="none" opacity=".7" />
        <path d="M132 43 C141 40 146 34 147 28" stroke={secondary} strokeWidth="1.3" fill="none" opacity=".6" />
      </> : null}
    </g>
  </svg>;
}
