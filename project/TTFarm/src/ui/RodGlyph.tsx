import type { FishingRod } from "../game/fish";

/** 背包与商店共用的鱼竿小图：竹节竿身、缠线轮与红漂 */
export function RodGlyph({ rod, size = 30 }: { rod: FishingRod; size?: number }) {
  return (
    <svg className="rod-glyph" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`rod-glyph-${rod.id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={rod.color} />
          <stop offset="1" stopColor={rod.accent} />
        </linearGradient>
      </defs>
      <path
        d="M7 56 C22 49 44 31 58 10"
        stroke={`url(#rod-glyph-${rod.id})`}
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M7 56 C22 49 44 31 58 10" stroke="#ffffff66" strokeWidth="1" fill="none" transform="translate(0 -1.4)" />
      <rect x="2" y="51" width="14" height="8" rx="3.5" fill="#5b4630" transform="rotate(-28 2 51)" />
      <circle cx="17" cy="48" r="4.4" fill="none" stroke="#e7e3cf" strokeWidth="1.5" />
      <path d="M17 48 14 45" stroke="#e7e3cf" strokeWidth="1.2" />
      <path d="M58 10 C57 28 46 44 28 50" stroke="#f5efd8" strokeWidth=".9" fill="none" opacity=".75" />
      <circle cx="28" cy="50" r="2" fill="#d94a34" />
      <path d="M21 42 18 41 M31 36 28 35 M41 28 38 27" stroke="#e7e3cf" strokeWidth="1.2" />
    </svg>
  );
}
