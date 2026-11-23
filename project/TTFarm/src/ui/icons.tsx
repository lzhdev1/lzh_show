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
    case "eggplant":
      return (
        <svg {...common}>
          <path d="M9 8.2c-1.8 2.4-2.6 5-2 7.6.7 3 3 4.8 5.6 4.4 3-.5 4.8-3.4 4.2-6.6-.5-2.8-2.4-5-4.6-6.2Z" fill={body} />
          <path d="M8.4 8.6l3.4-2 3.6 1.6-1.2 2.4-3.2.4-2.6-2.4Z" fill={leaf} />
          <path d="M11.6 6.4c.2-1.6 1-2.6 2.4-3" stroke={leaf} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "bean":
      return (
        <svg {...common}>
          <path d="M7 5.4c-1.6 4.4-1.4 9 .8 13.4" stroke={body} strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M12.4 4.6c-1 4.8-.6 9.6 1.4 14.2" stroke={body} strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M17.6 6c-.4 4.2.2 8.2 2 11.8" stroke={leaf} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "chili":
      return (
        <svg {...common}>
          <path d="M14.8 7.4c2.6 1.4 3.6 4.4 2.4 7.4-1.4 3.4-5 5.4-9.4 5 3.4-1.4 5.6-3.6 6.4-6.6.5-2 .4-4-.4-5.8Z" fill={body} />
          <path d="M13.6 7.6c-.4-1.8.2-3.2 1.8-4" stroke={leaf} strokeWidth="1.9" strokeLinecap="round" fill="none" />
          <path d="M12.4 7.2l2.8-.6.8 2.2-2.6.8-1-2.4Z" fill={leaf} />
        </svg>
      );
    case "watermelon":
      return (
        <svg {...common}>
          <circle cx="12" cy="13.4" r="7" fill={body} />
          <path d="M8.4 7.4c-1 3.8-1 8 0 12M12 6.4v14M15.6 7.4c1 3.8 1 8 0 12" stroke="#245c2c" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          <path d="M12 6.4c.4-1.4 1.4-2.2 2.8-2.4" stroke={leaf} strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "peach":
      return (
        <svg {...common}>
          <path d="M12 8.6c1.4-1.2 3.4-1.4 5-.4 2.2 1.4 2.8 4.4 1.4 7-1.6 3-4.4 4.8-6.4 5.6-2-.8-4.8-2.6-6.4-5.6-1.4-2.6-.8-5.6 1.4-7 1.6-1 3.6-.8 5 .4Z" fill={body} />
          <path d="M12 9v10.6" stroke="#d97f84" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12.4 7.8c.4-2 1.8-3.2 3.8-3.4-.2 2-1.6 3.2-3.8 3.4Z" fill={leaf} />
        </svg>
      );
    case "pear":
      return (
        <svg {...common}>
          <path d="M12 5.6c1.6 0 2.6 1.2 2.8 3 .2 1.6 1 2.6 2 3.8 1.6 2 1.4 5-.6 6.6-2.2 1.8-6.2 1.8-8.4 0-2-1.6-2.2-4.6-.6-6.6 1-1.2 1.8-2.2 2-3.8.2-1.8 1.2-3 2.8-3Z" fill={body} />
          <path d="M12 5.4V3.2" stroke="#8a6a3c" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12.6 4.6c1.4-1 2.8-1 4 .2-1.4 1-2.8 1-4-.2Z" fill={leaf} />
        </svg>
      );
    case "apricot":
      return (
        <svg {...common}>
          <circle cx="12" cy="13.8" r="6.6" fill={body} />
          <path d="M12 7.4c-1 2-1 4.2 0 6.4" stroke="#d18a2e" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M12.4 7c.4-1.8 1.6-2.8 3.4-3-.2 1.8-1.4 2.8-3.4 3Z" fill={leaf} />
        </svg>
      );
    case "jujube":
      return (
        <svg {...common}>
          <ellipse cx="8.2" cy="14.6" rx="3" ry="4" fill={body} />
          <ellipse cx="15.8" cy="14.6" rx="3" ry="4" fill={body} />
          <ellipse cx="12" cy="10.6" rx="3" ry="4" fill={body} />
          <path d="M12 6.4V4M8.2 10.4 7 8.6m8.8 1.8 1.2-1.8" stroke={leaf} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "tulip":
      return (
        <svg {...common}>
          <path d="M7.4 5.4v5.2c0 3 2 5 4.6 5s4.6-2 4.6-5V5.4l-2.4 2.2L12 5l-2.2 2.6-2.4-2.2Z" fill={body} />
          <path d="M12 15.6V21" stroke={leaf} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M12 19c-2.6-.2-4.2-1.4-4.8-3.6 2.6.2 4.2 1.4 4.8 3.6Z" fill={leaf} />
        </svg>
      );
    case "lily":
      return (
        <svg {...common}>
          <g fill={body} stroke="#d8cfbc" strokeWidth=".7">
            <path d="M12 12C10 8.4 10 5.6 12 3.4c2 2.2 2 5 0 8.6Z" />
            <path d="M12 12c3.8-1.6 6.6-1.2 8.4 1-2.4 1.6-5.2 1.2-8.4-1Z" />
            <path d="M12 12c-3.8-1.6-6.6-1.2-8.4 1 2.4 1.6 5.2 1.2 8.4-1Z" />
            <path d="M12 12c2.6 3 3 5.8 1.4 8.2-2.2-1.8-2.6-4.6-1.4-8.2Z" />
            <path d="M12 12c-2.6 3-3 5.8-1.4 8.2 2.2-1.8 2.6-4.6 1.4-8.2Z" />
          </g>
          <circle cx="12" cy="12" r="1.7" fill="#e8b23c" />
        </svg>
      );
    case "roseRed":
    case "rosePink":
    case "roseWhite":
    case "roseYellow":
    case "roseBlue":
    case "rosePurple":
      return (
        <svg {...common}>
          <path d="M12 13.4V21" stroke={leaf} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 18c-2.4-.2-3.8-1.2-4.4-3.2 2.4.2 3.8 1.2 4.4 3.2Z" fill={leaf} />
          <circle cx="12" cy="8.6" r="5.6" fill={body} />
          <path d="M12 8.6c-1.6-.2-2.4-1.2-2.2-2.6 1.6.2 2.4 1.2 2.2 2.6Zm0 0c1.8.4 2.8 1.6 2.6 3.2-1.8-.4-2.8-1.6-2.6-3.2Zm0 0c-1.4 1.2-2.8 1.2-4-.2 1.4-1.2 2.8-1.2 4 .2Z" fill="#00000022" />
          <circle cx="12" cy="8.6" r="1.6" fill="#00000026" />
        </svg>
      );
    case "pineapple":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="14.6" rx="5.4" ry="6.4" fill={body} />
          <path d="M8 10.8l8 7.6M16 10.8l-8 7.6M12 8.4v12.4" stroke="#b8842c" strokeWidth="1.1" />
          <path d="M12 8.2C10.4 6 10.2 4 11.2 2.2c1.4 1.4 1.8 3.4 1 6Zm0 0c2.4-1.4 4.4-1.4 6 .2-1.8 1.2-3.8 1.2-6-.2Zm0 0c-2.4-1.4-4.4-1.4-6 .2 1.8 1.2 3.8 1.2 6-.2Z" fill={leaf} />
        </svg>
      );
    case "durian":
      return (
        <svg {...common}>
          <path d="M12 4.6l1.5 2 2.4-.8.4 2.5 2.5.4-.8 2.4 2 1.5-2 1.5.8 2.4-2.5.4-.4 2.5-2.4-.8-1.5 2-1.5-2-2.4.8-.4-2.5-2.5-.4.8-2.4-2-1.5 2-1.5-.8-2.4 2.5-.4.4-2.5 2.4.8Z" fill={body} />
          <circle cx="12" cy="12.6" r="4.6" fill="#cdb86a" />
          <path d="M12 4.4V2.4" stroke="#8a6a3c" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      // 野菜共用一版嫩芽图标，按品种配色区分
      return (
        <svg {...common}>
          <path d="M12 21v-8.4" stroke={leaf} strokeWidth="2" strokeLinecap="round" />
          <path d="M12 13c-3.8.2-6-1.6-6.6-5.2 3.8-.2 6 1.6 6.6 5.2Z" fill={leaf} />
          <path d="M12 12.6c.4-3.8 2.4-5.8 6-6.2-.4 3.8-2.4 5.8-6 6.2Z" fill={body} />
          <circle cx="12" cy="6.4" r="1.6" fill={body} />
        </svg>
      );
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

export function SowIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeLinejoin="round" aria-hidden="true">
      <g transform="rotate(32 14 12)">
        <path d="M7 4h13v14l-3 2H7z" fill="#ead19c" stroke="#816943" strokeWidth="1.5"/>
        <path d="M7 7h13" stroke="#aa8751" strokeWidth="1.3"/>
        <path d="M13 16c.1-3.8 1.6-5.6 4.7-6.5.1 3.7-1.7 6.1-4.7 6.5Z" fill="#5c904a"/>
        <path d="M13 15c-2.4-.4-3.6-1.8-3.5-4.4 2.4.4 3.6 1.9 3.5 4.4Z" fill="#8bb960"/>
      </g>
      <g fill="#cc994a" stroke="#8b6939" strokeWidth="1">
        <ellipse cx="18" cy="23" rx="1.2" ry="1.9" transform="rotate(-30 18 23)"/>
        <ellipse cx="23.5" cy="24.5" rx="1.2" ry="1.9" transform="rotate(-47 23.5 24.5)"/>
        <ellipse cx="19.5" cy="28.5" rx="1.2" ry="1.6" transform="rotate(-18 19.5 28.5)"/>
      </g>
    </svg>
  );
}

export function WateringCanIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 10.5c.7-6.6 8.4-6.5 8.4.3 0 4.1-2.5 6.6-5.8 7.7" stroke="#406d76" strokeWidth="2.5"/>
      <path d="m13.3 17.5-6-4-2.1 2.2 8.4 8.1z" fill="#8cc2bd" stroke="#406d76" strokeWidth="1.4"/>
      <path d="M13.3 12.2h9.6l1.3 10c.2 1.6-1.2 2.8-2.7 2.8h-6.1c-1.7 0-3-1.3-2.8-3z" fill="#76aaa9" stroke="#406d76" strokeWidth="1.5"/>
      <path d="M13.4 13.1h9.5M16 16.8l-.4 4.4" stroke="#d0e8dc" strokeWidth="1.5"/>
      <path d="m3.6 15.9 4.3-4.3" stroke="#406d76" strokeWidth="2.8"/>
      <path d="m2.8 20.5-1 1.8m5-.7-1 2m5-.1-1.1 2.1" stroke="#5a9bbe" strokeWidth="1.5"/>
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

export function BagIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M6.2 8.2h11.6l1.3 11.2H4.9L6.2 8.2Z" fill="#e7c98f" stroke="#7d613c" strokeWidth="1.4" />
      <path d="M8.4 8.2V6.8a3.6 3.6 0 0 1 7.2 0v1.4" stroke="#7d613c" strokeWidth="1.8" fill="none" />
      <path d="M6.9 12.2h10.2M5.8 17.2h12.4" stroke="#b38a4f" strokeWidth="1.2" />
      <rect x="10.2" y="13.6" width="3.6" height="3" rx=".8" fill="#6d9855" stroke="#4f7a40" strokeWidth="1" />
    </svg>
  );
}

export function EquipmentIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3.6l6.4 2.5v5.5c0 4-2.6 6.8-6.4 8.8-3.8-2-6.4-4.8-6.4-8.8V6.1L12 3.6Z" fill="#c7d8dd" stroke="#637b83" strokeWidth="1.4" />
      <path d="M12 7.2v8.6M8.2 11.2h7.6" stroke="#637b83" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ItemIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M9.2 4.2h5.6v2.2l1.3 2.2v10.2H7.9V8.6l1.3-2.2V4.2Z" fill="#c9e5dc" stroke="#557f73" strokeWidth="1.4" />
      <path d="M9.8 11.2h4.4v5.2H9.8z" fill="#71b897" />
      <path d="M8.4 3.8h7.2" stroke="#557f73" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FishIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.8 12c3-3.6 7.9-4.2 10.9-1.2 1 1 1.6 2.5 3.5 2.8-1 1.4-1.4 2.6-3.5 3-3 3-7.9 2.4-10.9-1.2Z" fill="#cde7df" stroke="#557f73" strokeWidth="1.3" />
      <path d="M3.8 12 1.8 8.9 2.4 13.3 1.9 15.8Z" fill="#a8d2c5" stroke="#557f73" strokeWidth="1.1" />
      <circle cx="12.6" cy="10.7" r=".85" fill="#31483f" />
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

export function MushroomIcon({ cap = "#c46a55", stem = "#efdfc8", accent = "#f7e2a1", size = 22 }: {
  cap?: string; stem?: string; accent?: string; size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M4.2 11.2c.3-4.2 3.6-7.2 7.8-7.2s7.5 3 7.8 7.2c.1 1.2-.7 2.1-1.9 2.1H6.1c-1.2 0-2-.9-1.9-2.1Z" fill={cap} />
      <path d="M6.4 10.2c.4-2.6 2.5-4.5 5.6-4.5 1.6 0 3 .6 4 1.7-1-.4-2-.6-3.2-.6-2.5 0-4.6 1.3-6.4 3.4Z" fill="#fff6e8" opacity=".38" />
      <path d="M8.7 12.7h6.6v4.1c0 2.1-1.5 3.7-3.3 3.7s-3.3-1.6-3.3-3.7v-4.1Z" fill={stem} />
      <ellipse cx="9.3" cy="8.1" rx="1" ry=".75" fill={accent} />
      <ellipse cx="13.8" cy="7.2" rx=".8" ry=".6" fill={accent} />
      <ellipse cx="16.1" cy="9.1" rx=".65" ry=".5" fill={accent} />
      <path d="M9.8 14.5h4.4" stroke="#a18563" strokeWidth=".8" strokeLinecap="round" opacity=".55" />
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
