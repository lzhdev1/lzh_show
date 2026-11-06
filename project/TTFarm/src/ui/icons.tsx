import { CROPS, type CropId } from "../game/crops";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function CropIcon({ crop, size = 20 }: { crop: CropId; size?: number }) {
  const def = CROPS[crop];
  const body = hex(def.body);
  const leaf = hex(def.leaf);
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const };

  switch (crop) {
    case "radish":
      return (
        <svg {...common}>
          <path d="M12 8c-2.2 0-3.8-1.6-3.8-3.8 2.2 0 3.8 1.5 3.8 3.8Z" fill={leaf} />
          <path d="M12 8c2.2 0 3.8-1.6 3.8-3.8-2.2 0-3.8 1.5-3.8 3.8Z" fill={leaf} />
          <path d="M12 9.2c2.4 0 3.9 1.7 3.9 3.9 0 3.3-2 6-3.9 7.9-1.9-1.9-3.9-4.6-3.9-7.9 0-2.2 1.5-3.9 3.9-3.9Z" fill={body} />
          <path d="M10.6 18.6c.8 1 1.4 1.8 1.4 1.8s.6-.8 1.4-1.8H10.6Z" fill="#fdf7ea" />
        </svg>
      );
    case "cabbage":
      return (
        <svg {...common}>
          <circle cx="12" cy="14" r="6.4" fill={body} />
          <circle cx="8.4" cy="11.4" r="4" fill={leaf} />
          <circle cx="15.6" cy="11.4" r="4" fill={leaf} />
          <circle cx="12" cy="9.6" r="3.8" fill={leaf} opacity="0.85" />
        </svg>
      );
    case "tomato":
      return (
        <svg {...common}>
          <circle cx="12" cy="14.2" r="6.2" fill={body} />
          <path d="M12 8.4l1.3 2.4 2.7-.3-1.9 2 1.4 2.4-2.7-.9-2.7.9 1.4-2.4-1.9-2 2.7.3 1.4-2.4Z" fill={leaf} />
        </svg>
      );
    case "corn":
      return (
        <svg {...common}>
          <path d="M12 4.4c2.6 0 4.2 3.4 4.2 7.4S14.6 20 12 20s-4.2-4.2-4.2-8.2S9.4 4.4 12 4.4Z" fill={body} />
          <path d="M8 8.4C5.6 9.2 4.6 12 5 15.4c2.4-.2 4-2.6 3-7Z" fill={leaf} />
          <path d="M16 8.4c2.4.8 3.4 3.6 3 7-2.4-.2-4-2.6-3-7Z" fill={leaf} />
        </svg>
      );
    case "strawberry":
      return (
        <svg {...common}>
          <path d="M12 20c-3.6-2-5.6-4.6-5.6-7.2 0-2.2 1.6-3.4 3.4-3.4.9 0 1.7.3 2.2.9.5-.6 1.3-.9 2.2-.9 1.8 0 3.4 1.2 3.4 3.4 0 2.6-2 5.2-5.6 7.2Z" fill={body} />
          <path d="M8.6 7.2l1.5-2.4h3.8l1.5 2.4-3.4 1.8-3.4-1.8Z" fill={leaf} />
          <circle cx="10.4" cy="13" r=".8" fill="#fdf7ea" />
          <circle cx="13.6" cy="14.8" r=".8" fill="#fdf7ea" />
          <circle cx="12" cy="11.4" r=".8" fill="#fdf7ea" />
        </svg>
      );
    case "pumpkin":
      return (
        <svg {...common}>
          <ellipse cx="8.8" cy="14" rx="3.2" ry="5.4" fill={body} />
          <ellipse cx="15.2" cy="14" rx="3.2" ry="5.4" fill={body} />
          <ellipse cx="12" cy="14.2" rx="4.4" ry="5.8" fill={body} />
          <path d="M12 8.6V5.6" stroke={leaf} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#f2be4a" />
      <circle cx="12" cy="12" r="6.4" fill="#f9d579" />
      <path d="M12 7.6v8.8M9.4 10.2h5.2M9.4 13.6h5.2" stroke="#a97b22" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SeedIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20V11" stroke="#5f8f45" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 12c-3.6 0-5.6-2-5.6-5.4 3.6 0 5.6 2 5.6 5.4Z" fill="#6ba84c" />
      <path d="M12 14.4c3.4 0 5.4-2 5.4-5.2-3.4 0-5.4 2-5.4 5.2Z" fill="#8cc45e" />
    </svg>
  );
}

export function WaterIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.6c3 4.2 5.2 7 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-3.2 2.2-6 5.2-10.2Z" fill="#69a9c9" />
      <path d="M9.6 14.6a2.6 2.6 0 0 0 2.4 2.6" stroke="#d9eef7" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function HarvestIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M4.4 10.6h15.2l-1.6 8.2H6L4.4 10.6Z" fill="#c08f5c" />
      <path d="M7 10.6c0-2.9 2.2-5.2 5-5.2s5 2.3 5 5.2" stroke="#8a5a3b" strokeWidth="1.8" fill="none" />
      <circle cx="10" cy="7.2" r="1.8" fill="#6ba84c" />
      <circle cx="14.4" cy="6.4" r="1.6" fill="#e2603f" />
    </svg>
  );
}

export function ShopIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 8.6h14l-1 11.4H6L5 8.6Z" fill="#f6ecd8" />
      <path d="M5 8.6h14l-1 11.4H6L5 8.6Z" stroke="#8a7a5c" strokeWidth="1.4" fill="none" />
      <path d="M8.6 9c0-2.2 1.5-4 3.4-4s3.4 1.8 3.4 4" stroke="#8a7a5c" strokeWidth="1.6" fill="none" />
      <path d="M9.4 12.4h5.2M9.4 15.6h5.2" stroke="#6ba84c" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" stroke="#5c5344" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LandIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="3.6" y="5.4" width="16.8" height="13.2" rx="2" fill="#c5a173" />
      <path d="M7.2 9.4h3.6M7.2 12.8h3.6M7.2 16.2h3.6" stroke="#8a5a3b" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 12h4.2M17.1 9.9v4.2" stroke="#4a7a38" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="10.4" width="12" height="9.2" rx="2" fill="#9c8f7a" />
      <path d="M8.8 10.4V8.6a3.2 3.2 0 0 1 6.4 0v1.8" stroke="#9c8f7a" strokeWidth="1.8" fill="none" />
    </svg>
  );
}
