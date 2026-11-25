import { isRainy, weatherAt, WEATHER_INTERVAL_MS } from "./weather";

/**
 * 一百种野生菌。数据只描述“长什么样、爱长在哪、值多少钱”，
 * 真正的菌盖、菌褶、菌环与斑点由 mushroomModels.ts 按 shape/pattern 程序化生成。
 */
export type MushroomShape =
  | "umbrella" | "bell" | "flat" | "cone" | "morel" | "coral"
  | "fan" | "puff" | "cup" | "tooth" | "jelly" | "wax";
export type MushroomHabitat = "log" | "stump" | "trunk" | "shrub" | "ground";
export type MushroomPattern = "none" | "spots" | "ring" | "striate" | "scales" | "glow";
export type MushroomMutation = "magic" | "mist" | "spirit" | null;

export interface MushroomSpecies {
  id: string;
  name: string;
  cap: string;
  stem: string;
  gill: string;
  accent: string;
  shape: MushroomShape;
  pattern: MushroomPattern;
  habitat: MushroomHabitat;
  rarity: 1 | 2 | 3 | 4 | 5;
  price: number;
  size: number;
  blurb: string;
}

const NAMES = [
  "赤霞伞", "月白伞", "墨裙伞", "金褶伞", "青苔伞", "紫丁伞", "蜜环菌", "松乳菇", "鸡油菌", "牛肝菌",
  "羊肚菌", "竹荪", "猴头菇", "灵芝", "云芝", "树舌", "珊瑚菌", "绣球菌", "银耳", "木耳",
  "金耳", "鹿角菌", "马勃", "鬼笔", "星头菌", "萤光菌", "蓝帽菌", "红笼头菌", "白绒盖", "橙杯菌",
  "紫蜡伞", "黄蜡伞", "灰喇叭", "黑喇叭", "松茸", "榛蘑", "元蘑", "榛褐菇", "榆耳", "槐耳",
  "柳钉菇", "杨树菇", "桦褐孔菌", "桑黄", "茯苓", "猪苓", "雷丸", "蝉花", "冬虫夏草", "蛹虫草",
  "炭角菌", "炭团菌", "毛头鬼伞", "墨汁鬼伞", "晶粒鬼伞", "褶纹鬼伞", "小菇", "微皮伞", "皮伞", "小皮伞",
  "金钱菌", "冬菇", "金针菇", "滑子菇", "平菇", "秀珍菇", "杏鲍菇", "白灵菇", "蟹味菇", "白玉菇",
  "香菇", "花菇", "茶树菇", "大球盖菇", "姬松茸", "竹荪蛋", "红托竹荪", "棘托竹荪", "长裙竹荪", "短裙竹荪",
  "黄裙竹荪", "紫裙竹荪", "凤尾菇", "榆黄蘑", "金顶侧耳", "粉褶菌", "青褶伞", "红褶伞", "褐褶伞", "环柄菇",
  "青环菇", "白环菇", "红环菇", "紫环菇", "斑点伞", "豹斑鹅膏", "毒蝇伞", "橙盖伞", "白杆伞", "黑伞菌",
] as const;

const SHAPES: readonly MushroomShape[] = [
  "umbrella", "bell", "flat", "cone", "morel", "coral",
  "fan", "puff", "cup", "tooth", "jelly", "wax",
];
const HABITATS: readonly MushroomHabitat[] = ["log", "stump", "trunk", "shrub", "ground"];
const PATTERNS: readonly MushroomPattern[] = ["none", "spots", "ring", "striate", "scales", "glow"];

/** 少数名种保留自己的辨识度，其余按黄金角色相生成，一百种不会撞成一色。 */
const OVERRIDES: Partial<Record<number, Partial<MushroomSpecies>>> = {
  0: { shape: "umbrella", pattern: "spots", habitat: "shrub" },
  6: { shape: "umbrella", pattern: "ring", habitat: "trunk" },
  11: { shape: "bell", pattern: "striate", habitat: "log" },
  12: { shape: "tooth", pattern: "none", habitat: "trunk" },
  13: { shape: "fan", pattern: "ring", habitat: "log" },
  14: { shape: "fan", pattern: "striate", habitat: "log" },
  15: { shape: "fan", pattern: "scales", habitat: "trunk" },
  16: { shape: "coral", pattern: "none", habitat: "ground" },
  17: { shape: "puff", pattern: "none", habitat: "log" },
  18: { shape: "jelly", pattern: "none", habitat: "log" },
  19: { shape: "cup", pattern: "none", habitat: "log" },
  23: { shape: "wax", pattern: "striate", habitat: "ground" },
  48: { shape: "cone", pattern: "scales", habitat: "ground" },
  96: { shape: "umbrella", pattern: "spots", habitat: "shrub" },
  97: { shape: "bell", pattern: "scales", habitat: "stump" },
};

function hslHex(h: number, s: number, l: number) {
  const hh = ((h % 360) + 360) % 360 / 360;
  const sat = s / 100;
  const light = l / 100;
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const to255 = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to255(channel(hh + 1 / 3))}${to255(channel(hh))}${to255(channel(hh - 1 / 3))}`;
}

const HABITAT_TEXT: Record<MushroomHabitat, string> = {
  log: "只认淋透的朽木，菌丝顺着木纹钻进去，雨停后才肯冒头。",
  stump: "爱长在截断的老树桩上，一圈菌盖围成一朵小小的年轮。",
  trunk: "贴着活树的粗皮往上爬，远看像树干自己开出的花。",
  shrub: "藏在灌木根脚的阴凉里，拨开叶子才会发现。",
  ground: "生在湿润草坡的薄土层里，雨后一夜就能顶开草叶。",
};
const SHAPE_TEXT: Record<MushroomShape, string> = {
  umbrella: "菌盖撑得圆，菌褶细密，是菌季里最像小伞的一类。",
  bell: "钟形菌盖垂着裙边，走路带风时会轻轻摇晃。",
  flat: "成熟后菌盖摊平，边缘微微上翘，像一碟小菜。",
  cone: "尖顶菌盖带着鳞片，摸上去有粗粝的木质感。",
  morel: "菌盖布满蜂窝凹坑，凹槽里会兜住一小汪雨水。",
  coral: "不长菌盖，整株像一簇浅色珊瑚，分枝细密。",
  fan: "扇形菌盖一层叠一层贴在木头上，边缘有细密波纹。",
  puff: "圆滚滚的孢子包，踩一下会喷出一小团烟。",
  cup: "杯状菌盖盛着露水，边缘薄得透光。",
  tooth: "菌盖下挂着细密小刺，像一圈冻住的雨帘。",
  jelly: "半透明的胶质菌体，捏起来软乎乎的。",
  wax: "蜡质菌盖油亮，颜色比同族都更亮一截。",
};

/** 五个稀有度对应的单份收购价：30 / 120 / 480 / 1,920 / 6,666 */
export const MUSHROOM_RARITY_PRICE: Record<number, number> = { 1: 30, 2: 120, 3: 480, 4: 1_920, 5: 6_666 };
/** 一朵菌采到的份数：1–3 份 */
export const MUSHROOM_YIELD_MIN = 1;
export const MUSHROOM_YIELD_MAX = 3;

/** 采一朵菌给的经验：固定 15 */
export const MUSHROOM_PICK_XP = 15;

/** 采一朵菌拿到的份数：1–3 份随机 */
export function mushroomYieldOf(random = Math.random): number {
  return MUSHROOM_YIELD_MIN + Math.floor(random() * (MUSHROOM_YIELD_MAX - MUSHROOM_YIELD_MIN + 1));
}

export const MUSHROOM_LIST: readonly MushroomSpecies[] = NAMES.map((name, index) => {
  const hue = (index * 47 + 8) % 360;
  const shape = SHAPES[index % SHAPES.length];
  const pattern = PATTERNS[(index * 5 + 1) % PATTERNS.length];
  const habitat = HABITATS[(index * 3 + 1) % HABITATS.length];
  const rarity = (1 + (index % 5)) as 1 | 2 | 3 | 4 | 5;
  const base: MushroomSpecies = {
    id: `m${String(index + 1).padStart(3, "0")}`,
    name,
    cap: hslHex(hue, 58 + (index % 3) * 8, 54 - (index % 4) * 6),
    stem: hslHex(hue + 32, 24, 78 - (index % 3) * 5),
    gill: hslHex(hue + 18, 28, 40 + (index % 4) * 5),
    accent: hslHex(hue + 180, 64, 68),
    shape,
    pattern,
    habitat,
    rarity,
    price: MUSHROOM_RARITY_PRICE[rarity],
    size: 0.18 + (index % 5) * 0.035 + (rarity - 1) * 0.012,
    blurb: `${HABITAT_TEXT[habitat]}${SHAPE_TEXT[shape]}${index % 17 === 0 ? "菌季只有雨后一个天气阶段，错过就要再等一场雨。" : ""}`,
  };
  return { ...base, ...OVERRIDES[index] };
});

export const MUSHROOMS = Object.fromEntries(MUSHROOM_LIST.map((item) => [item.id, item])) as Record<string, MushroomSpecies>;

export const MUSHROOM_HABITAT_LABEL: Record<MushroomHabitat, string> = {
  log: "朽木", stump: "树桩", trunk: "树干", shrub: "灌木", ground: "草坡",
};
export const MUSHROOM_SHAPE_LABEL: Record<MushroomShape, string> = {
  umbrella: "伞形", bell: "钟形", flat: "平盖", cone: "锥盖", morel: "蜂窝", coral: "珊瑚",
  fan: "扇叠", puff: "马勃", cup: "杯形", tooth: "齿盖", jelly: "胶质", wax: "蜡质",
};
export const MUSHROOM_RARITY_LABEL: Record<number, string> = { 1: "常见", 2: "少见", 3: "稀有", 4: "珍稀", 5: "传说" };

/** 雨后一整个天气阶段的菌季；若紧接着下雪，菌季直接取消。 */
export function mushroomSeasonAt(now: number): { active: boolean; key: number; phaseEnds: number } {
  const slot = Math.floor(now / WEATHER_INTERVAL_MS);
  const current = weatherAt(now);
  const previous = weatherAt(now - WEATHER_INTERVAL_MS);
  return {
    active: isRainy(previous) && current !== "snow",
    key: slot,
    phaseEnds: (slot + 1) * WEATHER_INTERVAL_MS,
  };
}

function hash(text: string) {
  let n = 2166136261;
  for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

/** 雨后一场菌季在地面上最多同时保留的菌子数量 */
export const MUSHROOM_GROUND_CAP = 30;
/** 每种菌按刷新阶段固定变异：20% 概率变异，魔气 / 氤氲 / 通灵三者随机。 */
export function mushroomMutationAt(id: string, seasonKey: number): MushroomMutation {
  const roll = hash(`${id}:${seasonKey}:mut`);
  if (roll >= 0.20) return null;
  const kind = hash(`${id}:${seasonKey}:kind`);
  if (kind < 1 / 3) return "magic";
  if (kind < 2 / 3) return "mist";
  return "spirit";
}

export const MUSHROOM_MUTATION_LABEL: Record<Exclude<MushroomMutation, null>, string> = {
  magic: "魔气", mist: "氤氲", spirit: "通灵",
};

export const MUSHROOM_COMPLAINTS = [
  "这雨再下下去，菌褶都要泡发了。",
  "别踩我，靴子太沉了。",
  "骷髅朋友今天又迟到。",
  "彩虹桥那头其实堵车。",
  "树皮太硬，扎根真费劲。",
  "白天晒，晚上潮，做菌真难。",
  "你采我可以，能不能先夸一句？",
  "我昨天还长在树桩上，今天就搬家了。",
  "风一吹就晃，头晕。",
  "孢子撒了一路，亏大了。",
  "灌木叶子挡光，位置真差。",
  "再等十秒，我要挪个窝。",
  "别拿我炖汤，我有情绪。",
  "这地方虫子比访客多。",
  "雨后只有一阶段，我容易吗？",
  "路过的人都不看图鉴。",
  "再长高一寸，就够到蘑菇灯了。",
  "我不是毒菌，只是颜色张扬。",
];

export function complaintFor(id: string) {
  return MUSHROOM_COMPLAINTS[Math.floor(hash(id) * MUSHROOM_COMPLAINTS.length) % MUSHROOM_COMPLAINTS.length];
}
