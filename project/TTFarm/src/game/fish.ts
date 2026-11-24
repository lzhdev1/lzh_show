/** 河鱼图鉴与钓鱼数据：50 种鱼、5 档稀有度、鱼竿与难度曲线。 */

export type FishRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type FishBody = "slender" | "round" | "flat" | "deep" | "eel" | "puffer" | "sturgeon";
export type FishTail = "fan" | "fork" | "ribbon" | "crescent" | "round";
export type FishPattern = "plain" | "stripe" | "spot" | "patch" | "scale" | "glow" | "gradient";

export interface FishVisual {
  /** 模型长度（米），比真实体长略作夸张，保证岸上能看清 */
  length: number;
  /** 体高与体长的比例 */
  girth: number;
  body: FishBody;
  tail: FishTail;
  pattern: FishPattern;
  primary: number;
  secondary: number;
  belly: number;
  fin: number;
  accent: number;
  eye: number;
  /** 胡须长度（米），0 表示没有 */
  whiskers?: number;
  /** 自发光强度，珍稀鱼带一点灵光 */
  glow?: number;
}

export interface FishSpecies {
  id: string;
  name: string;
  rarity: FishRarity;
  price: number;
  blurb: string;
  /** 图鉴里的“功能”：入篓后的用途或江湖说法 */
  effect: string;
  visual: FishVisual;
}

export const FISH_RARITY: Record<FishRarity, { label: string; color: string; weight: number }> = {
  common: { label: "常见", color: "#96b3a6", weight: 26 },
  uncommon: { label: "少见", color: "#66b98d", weight: 10 },
  rare: { label: "稀有", color: "#6aaee8", weight: 3.2 },
  epic: { label: "史诗", color: "#bd92ea", weight: 0.9 },
  legendary: { label: "传说", color: "#e9b957", weight: 0.18 },
};

const v = (
  length: number, girth: number, body: FishBody, tail: FishTail, pattern: FishPattern,
  primary: string, secondary: string, belly: string, fin: string, accent: string,
  eye: string | number = "#161b1b", whiskers = 0, glow = 0,
): FishVisual => ({
  length, girth, body, tail, pattern,
  primary: parseInt(primary.slice(1), 16), secondary: parseInt(secondary.slice(1), 16),
  belly: parseInt(belly.slice(1), 16), fin: parseInt(fin.slice(1), 16),
  accent: parseInt(accent.slice(1), 16),
  eye: typeof eye === "number" ? eye : parseInt(eye.slice(1), 16),
  whiskers, glow,
});

/** 50 种鱼：常见 20 / 少见 15 / 稀有 8 / 史诗 4 / 传说 3。 */
export const FISH_LIST: readonly FishSpecies[] = [
  // —— 常见 ——
  { id: "maisui", name: "麦穗鱼", rarity: "common", price: 35,
    blurb: "只有手指长的小银鱼，成群贴着浅滩游，嘴尖得像一截麦穗。",
    effect: "炸小鱼最香；也是新手练竿的活教材。",
    visual: v(0.3, 0.18, "slender", "fan", "stripe", "#aebfb8", "#6f857d", "#e5eee8", "#bcd6ca", "#8fa8a0") },
  { id: "baitiao", name: "白条", rarity: "common", price: 45,
    blurb: "身子细长、游得极快，水面一有虫影就窜上来抢。",
    effect: "做钓大鱼的活饵，一竿能挂两条。",
    visual: v(0.38, 0.16, "slender", "fork", "plain", "#c9d8d2", "#8fa9a2", "#eff5f1", "#dce9e1", "#79a8b8") },
  { id: "jiyu", name: "鲫鱼", rarity: "common", price: 60,
    blurb: "圆背短身，鳞片带一层暗金，最爱在缓流里贴底觅食。",
    effect: "炖汤下奶，河岸人家的老底子补品。",
    visual: v(0.42, 0.36, "round", "fan", "scale", "#8d9a74", "#657156", "#e8e0c8", "#a8b18c", "#b7955a") },
  { id: "niqiu", name: "泥鳅", rarity: "common", price: 75,
    blurb: "黄褐小蛇一样钻泥，胡须比身子还灵，落竿就往泥里藏。",
    effect: "泥鳅钻豆腐，河鲜馆的招牌。",
    visual: v(0.34, 0.13, "eel", "round", "spot", "#89704c", "#5d4b31", "#c9b183", "#8d744d", "#c2a160", "#141010", 0.06) },
  { id: "liyu", name: "鲤鱼", rarity: "common", price: 90,
    blurb: "金鳞宽背，力气沉稳，咬钩后先横着走一段再发力。",
    effect: "红烧或糖醋都压得住席面。",
    visual: v(0.62, 0.34, "deep", "fan", "scale", "#b68645", "#7d542b", "#e7d4a7", "#c39a55", "#e0ba75", "#19130d", 0.05) },
  { id: "caoyu", name: "草鱼", rarity: "common", price: 110,
    blurb: "青灰长身，吃草长大，夏天常在水草边一口一口啃。",
    effect: "片成鱼片涮锅，肉厚刺少。",
    visual: v(0.78, 0.24, "slender", "fan", "plain", "#7b8f73", "#56684f", "#d8dfc9", "#92a383", "#8b9f6d") },
  { id: "bianyu", name: "鳊鱼", rarity: "common", price: 125,
    blurb: "侧扁得像一把小刀，银鳞薄得透光，成群逆流摆尾。",
    effect: "清蒸最见鲜味，火候过了就柴。",
    visual: v(0.48, 0.42, "flat", "fork", "gradient", "#b9c7c3", "#8da09c", "#f0f5ef", "#c7d5cf", "#78a7b3") },
  { id: "hualian", name: "花鲢", rarity: "common", price: 140,
    blurb: "脑袋大得离谱，身上撒着墨点，滤食时嘴巴一开一合。",
    effect: "鱼头汤的头牌，越大越体面。",
    visual: v(0.82, 0.42, "deep", "fan", "spot", "#7c8581", "#545c59", "#e1e6df", "#9aa39e", "#4d5654") },
  { id: "bailian", name: "白鲢", rarity: "common", price: 150,
    blurb: "浑身银白，受惊时会跃出水面，河面像炸开一片碎银。",
    effect: "腌成鱼干，冬天蒸一碗最下饭。",
    visual: v(0.86, 0.4, "deep", "fan", "plain", "#d7e1dd", "#a8b7b2", "#f4f8f3", "#e4ece6", "#9fb8c4") },
  { id: "lingyu", name: "鲮鱼", rarity: "common", price: 95,
    blurb: "头小背圆，喜欢用下唇刮食石上的青苔。",
    effect: "豆豉鲮鱼罐头的老祖宗，煎封最香。",
    visual: v(0.5, 0.3, "round", "fork", "plain", "#8b9a80", "#66755f", "#dddcc4", "#a4b094", "#8b9f89") },
  { id: "yingu", name: "银鲴", rarity: "common", price: 70,
    blurb: "细鳞银亮，嘴边一层刮食膜，常在浅滩石面上留下一道道痕。",
    effect: "裹粉酥炸，连骨都脆。",
    visual: v(0.36, 0.2, "slender", "fork", "plain", "#c2d1cb", "#91a8a1", "#eff4ee", "#d2e0d9", "#92b6c0") },
  { id: "makou", name: "马口鱼", rarity: "common", price: 85,
    blurb: "雄鱼婚姻色像打翻了胭脂，溪流急处一闪而过。",
    effect: "溪流钓的颜值担当，观赏缸里也压得住。",
    visual: v(0.34, 0.22, "slender", "fork", "stripe", "#8ca8a0", "#68837b", "#e7d7bd", "#c66d5d", "#d58b76") },
  { id: "pangpi", name: "鳑鲏", rarity: "common", price: 55,
    blurb: "铜钱大的小扁鱼，身上一道蓝紫虹彩，爱在蚌壳边产卵。",
    effect: "原生小缸里的群游明星。",
    visual: v(0.24, 0.42, "flat", "fan", "gradient", "#9eb8b0", "#7d6f9d", "#efe4df", "#c7a6c0", "#8fd0c2") },
  { id: "xiagu", name: "鰕虎鱼", rarity: "common", price: 50,
    blurb: "两只大眼顶在头上，趴在石缝里守洞，一有动静就缩回去。",
    effect: "潮汕鱼饭里的小角色，鲜得很。",
    visual: v(0.28, 0.22, "round", "round", "spot", "#7e7463", "#554d41", "#d1c6af", "#8d8371", "#9c8868") },
  { id: "shatangli", name: "沙塘鳢", rarity: "common", price: 145,
    blurb: "黑褐色的小伏击手，趴在沙底一动不动，专等小鱼路过。",
    effect: "炖蛋是江南春日的时令菜。",
    visual: v(0.42, 0.26, "deep", "round", "patch", "#5b5347", "#3d382f", "#b7aa8e", "#6e6454", "#8b7355") },
  { id: "huangsa", name: "黄颡鱼", rarity: "common", price: 160,
    blurb: "黄肚皮、三根硬刺，胡须一摆一摆，被扎一下能疼半天。",
    effect: "烧豆腐最鲜，刺要小心。",
    visual: v(0.4, 0.24, "slender", "fan", "gradient", "#b49353", "#6d5832", "#e6d596", "#c4a465", "#d7bb7b", "#18120c", 0.1) },
  { id: "nianyu", name: "鲶鱼", rarity: "common", price: 170,
    blurb: "大嘴、长须、滑不留手，夜里沿着河底慢慢巡游。",
    effect: "铁锅炖鲶鱼，贴一圈玉米饼子。",
    visual: v(0.75, 0.28, "eel", "round", "patch", "#5e574c", "#3f3b34", "#c6b89c", "#716858", "#8d7a5d", "#100e0c", 0.2) },
  { id: "qingyu", name: "青鱼", rarity: "common", price: 230,
    blurb: "青黑厚身，喉咙里有一块硬骨，专吃螺蛳，力气大得惊人。",
    effect: "青鱼石可做小挂件，鱼肉做熏鱼。",
    visual: v(0.92, 0.3, "deep", "fan", "scale", "#465957", "#2f4040", "#b7c7c0", "#637673", "#7f9691") },
  { id: "luofei", name: "罗非鱼", rarity: "common", price: 120,
    blurb: "背鳍带硬棘，身上一圈圈横纹，耐热耐脏，什么水都能活。",
    effect: "香煎最省事，肉厚少刺。",
    visual: v(0.52, 0.36, "deep", "fan", "stripe", "#7d8d83", "#556a5f", "#dbe2d4", "#9cad9d", "#6c9083") },
  { id: "chiyanzun", name: "赤眼鳟", rarity: "common", price: 130,
    blurb: "眼睛上半圈赤红，银身细长，常在流水中层结群。",
    effect: "清蒸或酸汤，红眼是它的记号。",
    visual: v(0.48, 0.2, "slender", "fork", "gradient", "#b8c7c4", "#839c98", "#edf2ec", "#c6d6d2", "#c25e4b") },

  // —— 少见 ——
  { id: "qiaozui", name: "翘嘴", rarity: "uncommon", price: 220,
    blurb: "下颌向上翘，游速快得像一道银箭，追着小鱼能把水面搅开。",
    effect: "路亚人的心头好，清蒸也行。",
    visual: v(0.78, 0.18, "slender", "fork", "plain", "#c4d4d1", "#8ca5a3", "#f0f5ef", "#d4e0dc", "#7fb0c7") },
  { id: "guiyu", name: "鳜鱼", rarity: "uncommon", price: 280,
    blurb: "背鳍带毒棘，身上斑块像水墨，躲在石缝里一口吞下猎物。",
    effect: "松鼠鳜鱼，宴席上的硬菜。",
    visual: v(0.6, 0.34, "deep", "fan", "patch", "#8b8266", "#5c5540", "#ddd2b8", "#8d7f5e", "#b7a77c") },
  { id: "luyu", name: "鲈鱼", rarity: "uncommon", price: 320,
    blurb: "银身黑背，侧线上一排黑点，秋天最肥，咬钩又凶又稳。",
    effect: "清蒸鲈鱼，火候正好时蒜瓣肉。",
    visual: v(0.68, 0.3, "deep", "fork", "stripe", "#a7b4b0", "#61716e", "#eef2ea", "#98aaa6", "#5e787a") },
  { id: "heiyu", name: "黑鱼", rarity: "uncommon", price: 210,
    blurb: "蛇头一样的脑袋，满身豹纹，能贴着水草潜伏半天不动。",
    effect: "酸菜鱼片的首选，肉紧不散。",
    visual: v(0.82, 0.24, "eel", "round", "patch", "#3f463f", "#282d29", "#aeb5a0", "#4c5448", "#7a7f62") },
  { id: "huangshan", name: "黄鳝", rarity: "uncommon", price: 190,
    blurb: "金黄细长，没有鳞，夜里从泥洞里探出头来换气。",
    effect: "响油鳝糊，一勺热油浇下去滋啦作响。",
    visual: v(0.7, 0.11, "eel", "round", "spot", "#b58b39", "#7b5c20", "#e4c376", "#c29a4b", "#d8b66a", "#17110a") },
  { id: "xishiban", name: "溪石斑", rarity: "uncommon", price: 260,
    blurb: "石缝里的横纹小霸王，水清流急处才长得好。",
    effect: "溪边现烤，撒一把盐就够。",
    visual: v(0.42, 0.3, "deep", "fan", "stripe", "#7a7a63", "#4d5142", "#d8d3b8", "#897e62", "#a99058") },
  { id: "tuanwenfang", name: "团头鲂", rarity: "uncommon", price: 180,
    blurb: "头小背高，身形像一枚团扇，喜欢在静水中层慢慢巡游。",
    effect: "武昌鱼的名头，清蒸最正。",
    visual: v(0.56, 0.44, "flat", "fork", "plain", "#aab9b1", "#7f948c", "#e6ece4", "#c0cec4", "#8fa9a3") },
  { id: "yinyu", name: "银鱼", rarity: "uncommon", price: 350,
    blurb: "通体透明，只有眼睛和一条细线，出水就软成一汪银。",
    effect: "银鱼炒蛋，鲜得不用放味精。",
    visual: v(0.3, 0.1, "slender", "fork", "glow", "#dcebea", "#a6c8c6", "#f6fbf7", "#e7f3ef", "#b8e4df", "#1a2322", 0, 0.45) },
  { id: "hongzun", name: "虹鳟", rarity: "uncommon", price: 480,
    blurb: "侧线一抹虹彩，冷水里才活得精神，逆流时尾巴拍得水花四溅。",
    effect: "做成刺身或烟熏，颜色最好看。",
    visual: v(0.62, 0.2, "slender", "fork", "stripe", "#9aa89b", "#5d6e63", "#eadfd4", "#b4787a", "#ce7f8f") },
  { id: "jinzun", name: "金鳟", rarity: "uncommon", price: 650,
    blurb: "通体金黄的鳟鱼变种，阳光下像一条游动的铜钱。",
    effect: "观赏与食用两相宜，鱼场里的招财招牌。",
    visual: v(0.6, 0.21, "slender", "fork", "gradient", "#d9a93f", "#a8761f", "#f2e2a3", "#e0bf62", "#f3d77e", 0, 0, 0.1) },
  { id: "jinli", name: "锦鲤", rarity: "uncommon", price: 800,
    blurb: "红白相间的大鲤，背脊圆润，游起来慢条斯理，自带贵气。",
    effect: "庭院池里的吉祥物，越养越通人性。",
    visual: v(0.8, 0.36, "deep", "fan", "patch", "#e2dfd1", "#c94f3b", "#f5f1e5", "#e9d7c8", "#d66845", 0, 0, 0.08) },
  { id: "jinyu", name: "金鱼", rarity: "uncommon", price: 520,
    blurb: "双尾像裙摆，身子圆滚滚，游动时一摇一摆，最是娇气。",
    effect: "案头小缸的常客，养好了能活很多年。",
    visual: v(0.32, 0.48, "round", "ribbon", "plain", "#e0712f", "#b54e1d", "#f7d7a8", "#f0a05c", "#ffd08b", 0, 0, 0.1) },
  { id: "zhuwenjin", name: "朱文锦", rarity: "uncommon", price: 420,
    blurb: "红白花的小金鱼，尾鳍轻薄，转起弯来像一团散开的朱砂。",
    effect: "老北京金鱼谱里的名品。",
    visual: v(0.3, 0.46, "round", "ribbon", "patch", "#f1eee4", "#c84438", "#f9f6ee", "#eac9bd", "#d96052") },
  { id: "xunyu", name: "鲟鱼", rarity: "uncommon", price: 950,
    blurb: "吻部尖长，背上一排骨板，游姿像一艘缓慢的古船。",
    effect: "鱼子酱的来处；本地只作观赏与清蒸。",
    visual: v(1.0, 0.22, "sturgeon", "crescent", "scale", "#77786b", "#4b4d44", "#cfcbb8", "#8d8a72", "#a59a78") },
  { id: "hetun", name: "河豚", rarity: "uncommon", price: 1200,
    blurb: "一受惊就鼓成一只带刺的球，眼睛滴溜溜转，脾气不小。",
    effect: "剧毒需专人处理；游戏里只入图鉴与鱼篓。",
    visual: v(0.4, 0.62, "puffer", "round", "spot", "#c9bf8f", "#8f855b", "#f0e6c4", "#c8b97d", "#5f5a43") },

  // —— 稀有 ——
  { id: "baishan", name: "白鳝", rarity: "rare", price: 550,
    blurb: "通体乳白的鳝，眼珠发红，只在月色最静的时候浮到浅水。",
    effect: "传说能入药，老渔民只肯在夜里提。",
    visual: v(0.78, 0.11, "eel", "round", "glow", "#e8eee8", "#b8c9c6", "#fbfdf8", "#dfe9e5", "#d8a3a3", "#9c2f2f", 0, 0.22) },
  { id: "manli", name: "鳗鲡", rarity: "rare", price: 700,
    blurb: "一生要回海里产卵的长鳗，银灰脊背，力气大得能把线拉成琴弦。",
    effect: "蒲烧鳗鱼，酱汁一刷就是一道名菜。",
    visual: v(0.95, 0.14, "eel", "round", "gradient", "#59675f", "#38443e", "#d1d6c4", "#77857b", "#9c8f6d") },
  { id: "yanzhi", name: "胭脂鱼", rarity: "rare", price: 1500,
    blurb: "背鳍高耸如帆，成鱼通体胭脂红，是长江里最艳的一条。",
    effect: "国家保护鱼类，钓到只作留念后放归。",
    visual: v(0.95, 0.38, "deep", "fan", "gradient", "#ab4351", "#762a3c", "#e9b3ab", "#d06c74", "#f0a08f", 0, 0, 0.15) },
  { id: "shiyu", name: "鲥鱼", rarity: "rare", price: 1800,
    blurb: "银鳞细密，出水即死，古时是快马加鞭送进京的贡品。",
    effect: "清蒸不去鳞，鳞下那层脂最金贵。",
    visual: v(0.72, 0.34, "deep", "fork", "scale", "#cfdbd6", "#96afa9", "#f3f6ee", "#d7e2dc", "#9cb9c1", 0, 0, 0.08) },
  { id: "daoyu", name: "刀鱼", rarity: "rare", price: 2200,
    blurb: "身子薄如刀，尾细如针，春汛一到就成群逆江而上。",
    effect: "刀鱼馄饨，鲜得眉毛都要掉。",
    visual: v(0.72, 0.13, "slender", "fork", "plain", "#d6e0dc", "#9eb3af", "#f5f9f4", "#dfe8e2", "#a9c4ca") },
  { id: "hudieli", name: "蝴蝶鲤", rarity: "rare", price: 1600,
    blurb: "长鳍像蝶翼，游动时在水里铺开一片轻纱，极难养。",
    effect: "庭院观赏的上品，鳍越飘越值钱。",
    visual: v(0.68, 0.3, "deep", "ribbon", "patch", "#f2efe6", "#dc8c7c", "#fbf8f0", "#ecd8cd", "#f0bda9", 0, 0, 0.1) },
  { id: "feicuigui", name: "翡翠鳜", rarity: "rare", price: 1300,
    blurb: "鳜鱼的翡翠色变种，鳞片像打磨过的玉，藏在深潭石洞里。",
    effect: "观赏价值远高于食用，鱼市上按对卖。",
    visual: v(0.62, 0.34, "deep", "fan", "patch", "#4f8c72", "#2c5b49", "#b8d8b8", "#6aa383", "#8fc29b", 0, 0, 0.12) },
  { id: "jinxianba", name: "金线鲃", rarity: "rare", price: 1100,
    blurb: "没有眼睛，靠胡须在溶洞暗河里找路，侧线像一条金线。",
    effect: "洞穴鱼的活标本，钓到便是稀客。",
    visual: v(0.46, 0.2, "eel", "round", "glow", "#cfae6a", "#8c6c32", "#e8d9ad", "#d2b370", "#f0d998", "#c9c0a0", 0.14, 0.2) },

  // —— 史诗 ——
  { id: "chilin", name: "赤鳞锦鲤", rarity: "epic", price: 3000,
    blurb: "每一片鳞都像烧红的铜，游过时水面会留下一条暖色的影子。",
    effect: "传说能镇宅旺水，鱼池里的活风水。",
    visual: v(0.9, 0.38, "deep", "fan", "scale", "#c24333", "#8c241d", "#f1c9a6", "#df7a55", "#ffc26e", 0, 0, 0.22) },
  { id: "yueguangxun", name: "月光银鲟", rarity: "epic", price: 3600,
    blurb: "背骨板泛着月白，夜里游过河心，像一截会动的月光。",
    effect: "只在无月的凌晨现身，老辈人说见一次能走三年好运。",
    visual: v(1.15, 0.2, "sturgeon", "crescent", "glow", "#c8d8de", "#8ca5b8", "#f0f7fa", "#d6e4ea", "#a8d8ef", 0, 0, 0.35) },
  { id: "xinghe", name: "星河鳟", rarity: "epic", price: 4800,
    blurb: "鳞下浮着细碎星点，逆流时整条鱼像一条流动的银河。",
    effect: "星夜垂钓的终极彩头，鳞片可作星砂。",
    visual: v(0.78, 0.22, "slender", "fork", "glow", "#6f92bc", "#3f5d8f", "#d9e8ef", "#8ca6cf", "#d8e9ff", 0, 0, 0.4) },
  { id: "xuanshui", name: "玄水鳡", rarity: "epic", price: 4200,
    blurb: "黑得像一段沉在水底的铁，细长、迅猛，一竿能拉出半条河的距离。",
    effect: "河中的顶级掠食者，钓它得用最粗的线。",
    visual: v(1.25, 0.17, "slender", "fork", "gradient", "#303c40", "#161d20", "#8b9b95", "#3f5053", "#6c8a8f", "#b23a2e") },

  // —— 传说 ——
  { id: "jinlinwang", name: "金鳞鲤王", rarity: "legendary", price: 8800,
    blurb: "活了不知多少年的老鲤，鳞片翻着赤金，游过时水声都沉下来。",
    effect: "渔村传说里的河伯坐骑，见者当浮一大白。",
    visual: v(1.35, 0.42, "deep", "fan", "scale", "#d1a23a", "#98681c", "#f3e1a3", "#e4bd57", "#ffe28a", 0, 0, 0.3) },
  { id: "jiuwenlong", name: "九纹龙鲤", rarity: "legendary", price: 12000,
    blurb: "墨底上九道金纹，转身时纹路像龙鳞逐节亮起。",
    effect: "只在雷雨后的河湾出现，钓线会被它拉出龙吟声。",
    visual: v(1.5, 0.4, "deep", "ribbon", "stripe", "#262c2e", "#111416", "#c8a45c", "#8f6c2f", "#f0c76b", 0, 0, 0.45) },
  { id: "xuanshuiwang", name: "玄水鳡王", rarity: "legendary", price: 16000,
    blurb: "整条河最深处的黑影，据说比人还长，出水时会把月光一并拖走。",
    effect: "河神的化身，钓到便写进族谱；多数人只见过它的背鳍。",
    visual: v(1.62, 0.19, "slender", "fork", "glow", "#1d262b", "#0b1013", "#6f8f96", "#2d4045", "#5f9eaa", "#d84b3b", 0, 0.5) },
];

export const FISH_BY_ID: Record<string, FishSpecies> = Object.fromEntries(
  FISH_LIST.map((fish) => [fish.id, fish]),
);

export const FISH_TOTAL = FISH_LIST.length;

export function fishById(id: unknown): FishSpecies | null {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(FISH_BY_ID, id)
    ? FISH_BY_ID[id]
    : null;
}

/** 按稀有度加权抽一条鱼；可以传入鱼饵的稀有度权重，未传则使用基础权重。 */
export function rollFish(random = Math.random, weights?: Partial<Record<FishRarity, number>>): FishSpecies {
  const weightOf = (fish: FishSpecies) => weights ? (weights[fish.rarity] ?? 0) : FISH_RARITY[fish.rarity].weight;
  let total = FISH_LIST.reduce((sum, fish) => sum + weightOf(fish), 0);
  if (total <= 0) total = FISH_LIST.reduce((sum, fish) => sum + FISH_RARITY[fish.rarity].weight, 0);
  if (total <= 0) return FISH_LIST[0];
  let pick = random() * total;
  for (const fish of FISH_LIST) {
    pick -= weights && weights[fish.rarity] !== undefined ? weights[fish.rarity]! : FISH_RARITY[fish.rarity].weight;
    if (pick <= 0) return fish;
  }
  return FISH_LIST[0];
}

/** 所有鱼都按价格给一点体长浮动，避免同种鱼一模一样的尺寸。 */
export function fishSize(fish: FishSpecies, random = Math.random): { length: number; weight: number } {
  const wobble = 0.82 + random() * 0.38;
  const length = fish.visual.length * wobble;
  // 近似按体长立方折算重量，纯展示用
  const weight = Math.pow(length, 2.65) * (fish.visual.girth > 0.4 ? 11 : 8);
  return { length, weight };
}

export function fishZoneWidth(fish: FishSpecies, rodBonus = 0): number {
  const base: Record<FishRarity, number> = { common: 0.33, uncommon: 0.26, rare: 0.20, epic: 0.155, legendary: 0.115 };
  const tiers: Record<FishRarity, number> = { common: 35, uncommon: 180, rare: 550, epic: 3000, legendary: 8800 };
  const scale = 1 - Math.min(0.16, Math.max(0, Math.log10(fish.price / tiers[fish.rarity]) * 0.12));
  return Math.min(0.40, Math.max(0.078, base[fish.rarity] * scale + rodBonus));
}

export function fishBallSpeed(fish: FishSpecies): number {
  const base: Record<FishRarity, number> = { common: 0.24, uncommon: 0.27, rare: 0.30, epic: 0.34, legendary: 0.38 };
  return base[fish.rarity] * (1 + Math.min(0.18, Math.max(0, Math.log10(fish.price / 35) - 1) * 0.10));
}

export interface FishingRod {
  id: string;
  name: string;
  level: number;
  price: number;
  color: string;
  accent: string;
  /** 高亮区额外宽度（比例） */
  zoneBonus: number;
  /** 抛竿距离（米） */
  castRange: number;
  blurb: string;
}

export const FISHING_RODS: readonly FishingRod[] = [
  { id: "bamboo", name: "溪竹竿", level: 1, price: 0, color: "#b98b4e", accent: "#f0d49a", zoneBonus: 0,
    castRange: 7.2, blurb: "老竹削成的入门竿，轻、韧，够用。" },
  { id: "stream", name: "青锋溪流竿", level: 4, price: 900, color: "#4e7d70", accent: "#cfe7d4", zoneBonus: 0.018,
    castRange: 8.4, blurb: "三节碳素竿，竿梢更灵，咬钩信号传得快。" },
  { id: "spirit", name: "灵纹鲤竿", level: 8, price: 4200, color: "#7a6ab0", accent: "#e6d5ff", zoneBonus: 0.035,
    castRange: 9.6, blurb: "竿身刻着细密灵纹，手感稳，拉大鱼不易脱钩。" },
  { id: "abyss", name: "沧海玄竿", level: 12, price: 12000, color: "#2b4e5e", accent: "#a8e7ef", zoneBonus: 0.055,
    castRange: 11.0, blurb: "深海玄木配银丝导环，专为传说中的巨物而制。" },
];

export const ROD_BY_ID: Record<string, FishingRod> = Object.fromEntries(FISHING_RODS.map((rod) => [rod.id, rod]));

export function rodById(id: unknown): FishingRod | null {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(ROD_BY_ID, id)
    ? ROD_BY_ID[id]
    : null;
}

export function normalizeFishingState(raw: unknown): { rod: string | null; fish: Record<string, number> } {
  const src = raw && typeof raw === "object" ? raw as { rod?: unknown; fish?: unknown } : {};
  const rod = rodById(src.rod)?.id ?? null;
  const fish: Record<string, number> = {};
  if (src.fish && typeof src.fish === "object") {
    for (const [id, count] of Object.entries(src.fish as Record<string, unknown>)) {
      if (!Object.prototype.hasOwnProperty.call(FISH_BY_ID, id)) continue;
      const n = Number(count);
      if (Number.isFinite(n) && n > 0) fish[id] = Math.min(1_000_000, Math.round(n));
    }
  }
  return { rod, fish };
}

/** 鱼竿是否已解锁：升级后自动获得，避免再叠一层购买流程。 */
export function rodUnlocked(rod: FishingRod, level: number): boolean {
  return level >= rod.level;
}
