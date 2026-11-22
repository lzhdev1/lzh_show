import { MUTATIONS, isHerbMutation, isSpirit, isWildMutation, type Mutation } from "./weather";

/** 作物配置表 */
export type CropId =
  | "radish"
  | "cabbage"
  | "tomato"
  | "corn"
  | "strawberry"
  | "pumpkin"
  | "eggplant"
  | "bean"
  | "chili"
  | "watermelon"
  | "peach"
  | "pear"
  | "apricot"
  | "jujube"
  | "tulip"
  | "lily"
  | "roseRed"
  | "rosePink"
  | "roseWhite"
  | "roseYellow"
  | "roseBlue"
  | "rosePurple"
  | "pineapple"
  | "durian"
  | WildGreenId
  | HerbId;

/** 野菜：商店不卖种子，只能野外采摘概率获得 */
export type WildGreenId =
  | "jicai"
  | "pugongying"
  | "machixian"
  | "juecai"
  | "xiangchun"
  | "yuqian"
  | "huaihua"
  | "huihuicai"
  | "yexiancai"
  | "cheqiancao"
  | "yuxingcao"
  | "yebohe"
  | "zisu"
  | "aicao"
  | "yecong"
  | "yesuan"
  | "shuiqin"
  | "louhao"
  | "malantou"
  | "juhuanao";

/** 草药：商店不卖，种子只能野外采到；变异走金木水火土 + 仙品 + 神品 */
export type HerbId =
  | "renshen" | "lingzhi" | "gouqi" | "danggui" | "huangqi"
  | "gancao" | "danshen" | "sanqi" | "chuanxiong" | "baishao"
  | "huanglian" | "huangqin" | "jinyinhua" | "juhua" | "honghua"
  | "longnaobohe" | "suye" | "qiai" | "heshouwu" | "wuweizi"
  | "tianma" | "duzhong" | "rougui" | "fuling" | "baizhu"
  | "chenpi" | "banxia" | "jiegeng" | "chaihu" | "fangfeng"
  | "duhuo" | "qianghuo" | "baizhi" | "cangzhu" | "houpo"
  | "sharen" | "huoxiang" | "peilan" | "xiangru" | "jingjie"
  | "lianqiao" | "banlangen" | "daqingye" | "xiakucao" | "yimucao"
  | "juemingzi" | "nvzhenzi" | "shanzhuyu" | "shihu" | "xuelian";

export interface CropDef {
  id: CropId;
  name: string;
  /** 种子价格 */
  seedPrice: number;
  /** 每份收成售价 */
  sellPrice: number;
  /** 一次收获产出份数 */
  yields: number;
  /** 成熟所需的真实毫秒（未浇水） */
  growMs: number;
  /** 解锁所需等级 */
  unlockLevel: number;
  /** 收获获得的经验 */
  xp: number;
  /** 果实主色 */
  body: number;
  /** 叶片主色 */
  leaf: number;
  /** 野菜标记：不进商店，种子靠野外采摘掉落 */
  wild?: boolean;
  /** 草药标记：不进商店，野外草药丛掉落种子，变异走五行 / 仙品 / 神品 */
  herb?: boolean;
}

export const CROPS: Record<CropId, CropDef> = {
  radish: {
    id: "radish",
    name: "萝卜",
    seedPrice: 12,
    sellPrice: 9,
    yields: 2,
    growMs: 40_000,
    unlockLevel: 1,
    xp: 3,
    body: 0xe2557b,
    leaf: 0x5f9d46,
  },
  cabbage: {
    id: "cabbage",
    name: "白菜",
    seedPrice: 20,
    sellPrice: 14,
    yields: 2,
    growMs: 60_000,
    unlockLevel: 1,
    xp: 5,
    body: 0xa8d67f,
    leaf: 0x4c8c3a,
  },
  tomato: {
    id: "tomato",
    name: "番茄",
    seedPrice: 35,
    sellPrice: 16,
    yields: 3,
    growMs: 80_000,
    unlockLevel: 2,
    xp: 7,
    body: 0xe04b34,
    leaf: 0x4f8f3f,
  },
  corn: {
    id: "corn",
    name: "玉米",
    seedPrice: 50,
    sellPrice: 20,
    yields: 3,
    growMs: 110_000,
    unlockLevel: 3,
    xp: 9,
    body: 0xf2c94c,
    leaf: 0x5a9a42,
  },
  strawberry: {
    id: "strawberry",
    name: "草莓",
    seedPrice: 70,
    sellPrice: 26,
    yields: 3,
    growMs: 140_000,
    unlockLevel: 4,
    xp: 12,
    body: 0xe03b3b,
    leaf: 0x4f8f3f,
  },
  pumpkin: {
    id: "pumpkin",
    name: "南瓜",
    seedPrice: 90,
    sellPrice: 55,
    yields: 2,
    growMs: 180_000,
    unlockLevel: 5,
    xp: 18,
    body: 0xef8b2c,
    leaf: 0x5a8f3a,
  },
  eggplant: {
    id: "eggplant",
    name: "茄子",
    seedPrice: 28,
    sellPrice: 13,
    yields: 3,
    growMs: 70_000,
    unlockLevel: 2,
    xp: 6,
    body: 0x6a3d8f,
    leaf: 0x4f8f3f,
  },
  bean: {
    id: "bean",
    name: "豆角",
    seedPrice: 42,
    sellPrice: 15,
    yields: 4,
    growMs: 95_000,
    unlockLevel: 3,
    xp: 8,
    body: 0x7fb54a,
    leaf: 0x4c8c3a,
  },
  chili: {
    id: "chili",
    name: "辣椒",
    seedPrice: 60,
    sellPrice: 22,
    yields: 3,
    growMs: 120_000,
    unlockLevel: 4,
    xp: 10,
    body: 0xd93a26,
    leaf: 0x4f8f3f,
  },
  watermelon: {
    id: "watermelon",
    name: "西瓜",
    seedPrice: 85,
    sellPrice: 48,
    yields: 2,
    growMs: 165_000,
    unlockLevel: 5,
    xp: 15,
    body: 0x3f9149,
    leaf: 0x5a8f3a,
  },
  peach: {
    id: "peach",
    name: "桃子",
    seedPrice: 110,
    sellPrice: 40,
    yields: 3,
    growMs: 200_000,
    unlockLevel: 6,
    xp: 18,
    body: 0xf2a0a0,
    leaf: 0x5a9a42,
  },
  pear: {
    id: "pear",
    name: "梨",
    seedPrice: 115,
    sellPrice: 42,
    yields: 3,
    growMs: 210_000,
    unlockLevel: 6,
    xp: 18,
    body: 0xd8e08a,
    leaf: 0x5a9a42,
  },
  apricot: {
    id: "apricot",
    name: "杏",
    seedPrice: 135,
    sellPrice: 46,
    yields: 3,
    growMs: 230_000,
    unlockLevel: 7,
    xp: 20,
    body: 0xf2b04c,
    leaf: 0x5a9a42,
  },
  jujube: {
    id: "jujube",
    name: "枣",
    seedPrice: 140,
    sellPrice: 48,
    yields: 3,
    growMs: 240_000,
    unlockLevel: 7,
    xp: 20,
    body: 0xa83c2a,
    leaf: 0x5a9a42,
  },
  tulip: {
    id: "tulip",
    name: "郁金香",
    seedPrice: 160,
    sellPrice: 60,
    yields: 3,
    growMs: 260_000,
    unlockLevel: 8,
    xp: 24,
    body: 0xe05a4e,
    leaf: 0x4f9a52,
  },
  lily: {
    id: "lily",
    name: "百合",
    seedPrice: 170,
    sellPrice: 64,
    yields: 3,
    growMs: 270_000,
    unlockLevel: 8,
    xp: 24,
    body: 0xf5f0e6,
    leaf: 0x4f9a52,
  },
  roseRed: {
    id: "roseRed",
    name: "红玫瑰",
    seedPrice: 190,
    sellPrice: 72,
    yields: 3,
    growMs: 280_000,
    unlockLevel: 9,
    xp: 26,
    body: 0xc42b45,
    leaf: 0x3f7d42,
  },
  rosePink: {
    id: "rosePink",
    name: "粉玫瑰",
    seedPrice: 190,
    sellPrice: 72,
    yields: 3,
    growMs: 280_000,
    unlockLevel: 9,
    xp: 26,
    body: 0xef8ba8,
    leaf: 0x3f7d42,
  },
  roseWhite: {
    id: "roseWhite",
    name: "白玫瑰",
    seedPrice: 205,
    sellPrice: 78,
    yields: 3,
    growMs: 290_000,
    unlockLevel: 10,
    xp: 27,
    body: 0xf6f1e4,
    leaf: 0x3f7d42,
  },
  roseYellow: {
    id: "roseYellow",
    name: "黄玫瑰",
    seedPrice: 205,
    sellPrice: 78,
    yields: 3,
    growMs: 290_000,
    unlockLevel: 10,
    xp: 27,
    body: 0xf2c14c,
    leaf: 0x3f7d42,
  },
  roseBlue: {
    id: "roseBlue",
    name: "蓝玫瑰",
    seedPrice: 220,
    sellPrice: 85,
    yields: 3,
    growMs: 300_000,
    unlockLevel: 10,
    xp: 28,
    body: 0x5a7fd6,
    leaf: 0x3f7d42,
  },
  rosePurple: {
    id: "rosePurple",
    name: "紫玫瑰",
    seedPrice: 220,
    sellPrice: 85,
    yields: 3,
    growMs: 300_000,
    unlockLevel: 10,
    xp: 28,
    body: 0x8a55b8,
    leaf: 0x3f7d42,
  },
  pineapple: {
    id: "pineapple",
    name: "菠萝",
    seedPrice: 260,
    sellPrice: 105,
    yields: 2,
    growMs: 330_000,
    unlockLevel: 11,
    xp: 32,
    body: 0xe8b23c,
    leaf: 0x4c9a52,
  },
  durian: {
    id: "durian",
    name: "榴莲",
    seedPrice: 320,
    sellPrice: 150,
    yields: 2,
    growMs: 380_000,
    unlockLevel: 12,
    xp: 40,
    body: 0xb9a24a,
    leaf: 0x4c8c3a,
  },
  // —— 野菜：种子只能野外采摘获得，种回农场后按野菜变异规则抽签 ——
  jicai:      { id: "jicai",      name: "荠菜",   seedPrice: 0, sellPrice: 22, yields: 2, growMs: 90_000,  unlockLevel: 1, xp: 8,  body: 0x9dc06a, leaf: 0x5f9d46, wild: true },
  pugongying: { id: "pugongying", name: "蒲公英", seedPrice: 0, sellPrice: 20, yields: 2, growMs: 85_000,  unlockLevel: 1, xp: 8,  body: 0xf2d878, leaf: 0x6aa04c, wild: true },
  machixian:  { id: "machixian",  name: "马齿苋", seedPrice: 0, sellPrice: 24, yields: 2, growMs: 95_000,  unlockLevel: 1, xp: 9,  body: 0xb8d078, leaf: 0x7aa85a, wild: true },
  juecai:     { id: "juecai",     name: "蕨菜",   seedPrice: 0, sellPrice: 30, yields: 2, growMs: 120_000, unlockLevel: 1, xp: 11, body: 0x8aa86a, leaf: 0x4c8c4a, wild: true },
  xiangchun:  { id: "xiangchun",  name: "香椿",   seedPrice: 0, sellPrice: 36, yields: 2, growMs: 150_000, unlockLevel: 1, xp: 13, body: 0xb85a48, leaf: 0x6a9a4c, wild: true },
  yuqian:     { id: "yuqian",     name: "榆钱",   seedPrice: 0, sellPrice: 26, yields: 2, growMs: 105_000, unlockLevel: 1, xp: 9,  body: 0xc2d888, leaf: 0x6aa04c, wild: true },
  huaihua:    { id: "huaihua",    name: "槐花",   seedPrice: 0, sellPrice: 32, yields: 2, growMs: 130_000, unlockLevel: 1, xp: 12, body: 0xf5f0d8, leaf: 0x5f9d46, wild: true },
  huihuicai:  { id: "huihuicai",  name: "灰灰菜", seedPrice: 0, sellPrice: 20, yields: 2, growMs: 85_000,  unlockLevel: 1, xp: 8,  body: 0xa8c088, leaf: 0x7aa868, wild: true },
  yexiancai:  { id: "yexiancai",  name: "野苋菜", seedPrice: 0, sellPrice: 24, yields: 2, growMs: 95_000,  unlockLevel: 1, xp: 9,  body: 0xc86a78, leaf: 0x6a9a52, wild: true },
  cheqiancao: { id: "cheqiancao", name: "车前草", seedPrice: 0, sellPrice: 22, yields: 2, growMs: 90_000,  unlockLevel: 1, xp: 8,  body: 0x90b868, leaf: 0x5a9a4c, wild: true },
  yuxingcao:  { id: "yuxingcao",  name: "鱼腥草", seedPrice: 0, sellPrice: 28, yields: 2, growMs: 110_000, unlockLevel: 1, xp: 10, body: 0xd8e8d0, leaf: 0x5f8f5a, wild: true },
  yebohe:     { id: "yebohe",     name: "野薄荷", seedPrice: 0, sellPrice: 30, yields: 2, growMs: 115_000, unlockLevel: 1, xp: 11, body: 0x8fd8a8, leaf: 0x4c9a5a, wild: true },
  zisu:       { id: "zisu",       name: "紫苏",   seedPrice: 0, sellPrice: 32, yields: 2, growMs: 125_000, unlockLevel: 1, xp: 12, body: 0x8a5a98, leaf: 0x6a4a78, wild: true },
  aicao:      { id: "aicao",      name: "艾草",   seedPrice: 0, sellPrice: 26, yields: 2, growMs: 105_000, unlockLevel: 1, xp: 9,  body: 0xb8c8a8, leaf: 0x8aa878, wild: true },
  yecong:     { id: "yecong",     name: "野葱",   seedPrice: 0, sellPrice: 24, yields: 2, growMs: 95_000,  unlockLevel: 1, xp: 9,  body: 0xa8d078, leaf: 0x6aa84c, wild: true },
  yesuan:     { id: "yesuan",     name: "野蒜",   seedPrice: 0, sellPrice: 26, yields: 2, growMs: 100_000, unlockLevel: 1, xp: 9,  body: 0xe8e8d8, leaf: 0x7aa858, wild: true },
  shuiqin:    { id: "shuiqin",    name: "水芹菜", seedPrice: 0, sellPrice: 28, yields: 2, growMs: 110_000, unlockLevel: 1, xp: 10, body: 0x98c878, leaf: 0x5a9a52, wild: true },
  louhao:     { id: "louhao",     name: "蒌蒿",   seedPrice: 0, sellPrice: 26, yields: 2, growMs: 105_000, unlockLevel: 1, xp: 9,  body: 0xa8b878, leaf: 0x7a9a58, wild: true },
  malantou:   { id: "malantou",   name: "马兰头", seedPrice: 0, sellPrice: 28, yields: 2, growMs: 110_000, unlockLevel: 1, xp: 10, body: 0x9a7ab8, leaf: 0x5f9d4c, wild: true },
  juhuanao:   { id: "juhuanao",   name: "菊花脑", seedPrice: 0, sellPrice: 30, yields: 2, growMs: 115_000, unlockLevel: 1, xp: 11, body: 0xf2d068, leaf: 0x6aa04c, wild: true },
  // —— 草药：种子只野外掉落；生长慢、单价高，变异规则独立（五行 / 仙品 / 神品） ——
  // 常见档：枸杞、薄荷、艾、金银花、菊花、红花、陈皮、半夏、桔梗、板蓝根等
  gouqi:       { id: "gouqi",       name: "枸杞",     seedPrice: 0, sellPrice: 52,  yields: 1, growMs: 150_000, unlockLevel: 1, xp: 14, body: 0xd8442c, leaf: 0x5f9448, herb: true },
  longnaobohe: { id: "longnaobohe", name: "龙脑薄荷", seedPrice: 0, sellPrice: 46,  yields: 1, growMs: 140_000, unlockLevel: 1, xp: 13, body: 0xcfe8d0, leaf: 0x5f9a58, herb: true },
  suye:        { id: "suye",        name: "苏叶",     seedPrice: 0, sellPrice: 46,  yields: 1, growMs: 140_000, unlockLevel: 1, xp: 13, body: 0x8a4a7a, leaf: 0x6a4a78, herb: true },
  qiai:        { id: "qiai",        name: "蕲艾",     seedPrice: 0, sellPrice: 42,  yields: 1, growMs: 135_000, unlockLevel: 1, xp: 12, body: 0xd8e0c0, leaf: 0x8aa878, herb: true },
  jinyinhua:   { id: "jinyinhua",   name: "金银花",   seedPrice: 0, sellPrice: 62,  yields: 1, growMs: 170_000, unlockLevel: 1, xp: 16, body: 0xf2e6a0, leaf: 0x5f9a4a, herb: true },
  juhua:       { id: "juhua",       name: "菊花",     seedPrice: 0, sellPrice: 56,  yields: 1, growMs: 160_000, unlockLevel: 1, xp: 15, body: 0xf2cf5a, leaf: 0x5f9448, herb: true },
  honghua:     { id: "honghua",     name: "红花",     seedPrice: 0, sellPrice: 64,  yields: 1, growMs: 170_000, unlockLevel: 1, xp: 16, body: 0xe0562e, leaf: 0x6a9a50, herb: true },
  huoxiang:    { id: "huoxiang",    name: "藿香",     seedPrice: 0, sellPrice: 50,  yields: 1, growMs: 150_000, unlockLevel: 1, xp: 14, body: 0xb07ac0, leaf: 0x5f9a50, herb: true },
  peilan:      { id: "peilan",      name: "佩兰",     seedPrice: 0, sellPrice: 50,  yields: 1, growMs: 150_000, unlockLevel: 1, xp: 14, body: 0xd0a0e0, leaf: 0x6a9a55, herb: true },
  xiangru:     { id: "xiangru",     name: "香薷",     seedPrice: 0, sellPrice: 46,  yields: 1, growMs: 145_000, unlockLevel: 1, xp: 13, body: 0xc8b0e0, leaf: 0x6f9a55, herb: true },
  jingjie:     { id: "jingjie",     name: "荆芥",     seedPrice: 0, sellPrice: 46,  yields: 1, growMs: 145_000, unlockLevel: 1, xp: 13, body: 0xd8c0e8, leaf: 0x6a9a50, herb: true },
  chenpi:      { id: "chenpi",      name: "陈皮",     seedPrice: 0, sellPrice: 58,  yields: 1, growMs: 160_000, unlockLevel: 1, xp: 15, body: 0xef9a3a, leaf: 0x4f8a45, herb: true },
  banxia:      { id: "banxia",      name: "半夏",     seedPrice: 0, sellPrice: 50,  yields: 1, growMs: 150_000, unlockLevel: 1, xp: 14, body: 0x9ab06a, leaf: 0x5f9a50, herb: true },
  jiegeng:     { id: "jiegeng",     name: "桔梗",     seedPrice: 0, sellPrice: 56,  yields: 1, growMs: 160_000, unlockLevel: 1, xp: 15, body: 0x7a6ac0, leaf: 0x5f9448, herb: true },
  banlangen:   { id: "banlangen",   name: "板蓝根",   seedPrice: 0, sellPrice: 56,  yields: 1, growMs: 160_000, unlockLevel: 1, xp: 15, body: 0xf2d060, leaf: 0x5f9a50, herb: true },
  daqingye:    { id: "daqingye",    name: "大青叶",   seedPrice: 0, sellPrice: 50,  yields: 1, growMs: 155_000, unlockLevel: 1, xp: 14, body: 0x4f6a9a, leaf: 0x5a8f50, herb: true },
  xiakucao:    { id: "xiakucao",    name: "夏枯草",   seedPrice: 0, sellPrice: 58,  yields: 1, growMs: 170_000, unlockLevel: 1, xp: 16, body: 0xa07ac0, leaf: 0x6a9a50, herb: true },
  yimucao:     { id: "yimucao",     name: "益母草",   seedPrice: 0, sellPrice: 58,  yields: 1, growMs: 170_000, unlockLevel: 1, xp: 16, body: 0xc07ad0, leaf: 0x5f9448, herb: true },
  juemingzi:   { id: "juemingzi",   name: "决明子",   seedPrice: 0, sellPrice: 52,  yields: 1, growMs: 155_000, unlockLevel: 1, xp: 14, body: 0xf2d060, leaf: 0x6a9a50, herb: true },
  nvzhenzi:    { id: "nvzhenzi",    name: "女贞子",   seedPrice: 0, sellPrice: 82,  yields: 1, growMs: 195_000, unlockLevel: 1, xp: 18, body: 0x5a4a8a, leaf: 0x3f7a3f, herb: true },
  // 中档：根茎与花穗类药材
  danggui:     { id: "danggui",     name: "当归",     seedPrice: 0, sellPrice: 112, yields: 1, growMs: 230_000, unlockLevel: 1, xp: 22, body: 0xdad2b4, leaf: 0x6f9b50, herb: true },
  huangqi:     { id: "huangqi",     name: "黄芪",     seedPrice: 0, sellPrice: 102, yields: 1, growMs: 220_000, unlockLevel: 1, xp: 21, body: 0xf0e2a0, leaf: 0x74a04e, herb: true },
  gancao:      { id: "gancao",      name: "甘草",     seedPrice: 0, sellPrice: 90,  yields: 1, growMs: 200_000, unlockLevel: 1, xp: 19, body: 0xc9a6e0, leaf: 0x7aa352, herb: true },
  danshen:     { id: "danshen",     name: "丹参",     seedPrice: 0, sellPrice: 95,  yields: 1, growMs: 210_000, unlockLevel: 1, xp: 20, body: 0xb03a5a, leaf: 0x5f8f48, herb: true },
  chuanxiong:  { id: "chuanxiong",  name: "川芎",     seedPrice: 0, sellPrice: 95,  yields: 1, growMs: 210_000, unlockLevel: 1, xp: 20, body: 0xf2efe0, leaf: 0x6e9a55, herb: true },
  baishao:     { id: "baishao",     name: "白芍",     seedPrice: 0, sellPrice: 120, yields: 1, growMs: 240_000, unlockLevel: 1, xp: 23, body: 0xf3e6ea, leaf: 0x5d8f47, herb: true },
  huanglian:   { id: "huanglian",   name: "黄连",     seedPrice: 0, sellPrice: 100, yields: 1, growMs: 220_000, unlockLevel: 1, xp: 21, body: 0xe8d070, leaf: 0x5c8f45, herb: true },
  huangqin:    { id: "huangqin",    name: "黄芩",     seedPrice: 0, sellPrice: 90,  yields: 1, growMs: 205_000, unlockLevel: 1, xp: 19, body: 0x9a7ad0, leaf: 0x6b9a50, herb: true },
  chaihu:      { id: "chaihu",      name: "柴胡",     seedPrice: 0, sellPrice: 86,  yields: 1, growMs: 200_000, unlockLevel: 1, xp: 19, body: 0xe8e0a0, leaf: 0x6f9a50, herb: true },
  fangfeng:    { id: "fangfeng",    name: "防风",     seedPrice: 0, sellPrice: 90,  yields: 1, growMs: 205_000, unlockLevel: 1, xp: 19, body: 0xf0f0e0, leaf: 0x6a9a55, herb: true },
  duhuo:       { id: "duhuo",       name: "独活",     seedPrice: 0, sellPrice: 96,  yields: 1, growMs: 210_000, unlockLevel: 1, xp: 20, body: 0xe8efe0, leaf: 0x5f8f4a, herb: true },
  qianghuo:    { id: "qianghuo",    name: "羌活",     seedPrice: 0, sellPrice: 100, yields: 1, growMs: 215_000, unlockLevel: 1, xp: 20, body: 0xf0ead0, leaf: 0x6a9a50, herb: true },
  baizhi:      { id: "baizhi",      name: "白芷",     seedPrice: 0, sellPrice: 100, yields: 1, growMs: 220_000, unlockLevel: 1, xp: 21, body: 0xf2f0e0, leaf: 0x6f9a55, herb: true },
  baizhu:      { id: "baizhu",      name: "白术",     seedPrice: 0, sellPrice: 110, yields: 1, growMs: 230_000, unlockLevel: 1, xp: 22, body: 0xe0d4b0, leaf: 0x6f9a50, herb: true },
  cangzhu:     { id: "cangzhu",     name: "苍术",     seedPrice: 0, sellPrice: 105, yields: 1, growMs: 225_000, unlockLevel: 1, xp: 21, body: 0xd8c890, leaf: 0x7a8f50, herb: true },
  sharen:      { id: "sharen",      name: "砂仁",     seedPrice: 0, sellPrice: 120, yields: 1, growMs: 230_000, unlockLevel: 1, xp: 22, body: 0xe8d070, leaf: 0x5f8a45, herb: true },
  lianqiao:    { id: "lianqiao",    name: "连翘",     seedPrice: 0, sellPrice: 80,  yields: 1, growMs: 195_000, unlockLevel: 1, xp: 18, body: 0xf2d050, leaf: 0x5f8f45, herb: true },
  houpo:       { id: "houpo",       name: "厚朴",     seedPrice: 0, sellPrice: 140, yields: 1, growMs: 250_000, unlockLevel: 1, xp: 24, body: 0xc08a6a, leaf: 0x4f7a3f, herb: true },
  shihu:       { id: "shihu",       name: "石斛",     seedPrice: 0, sellPrice: 160, yields: 1, growMs: 270_000, unlockLevel: 1, xp: 26, body: 0x9ad0a0, leaf: 0x6a9a50, herb: true },
  // 珍稀档：年份药材与高山灵草
  renshen:     { id: "renshen",     name: "人参",     seedPrice: 0, sellPrice: 260, yields: 1, growMs: 340_000, unlockLevel: 1, xp: 34, body: 0xf0e0c0, leaf: 0x4f8a45, herb: true },
  lingzhi:     { id: "lingzhi",     name: "灵芝",     seedPrice: 0, sellPrice: 220, yields: 1, growMs: 300_000, unlockLevel: 1, xp: 30, body: 0x9c3a2a, leaf: 0x6a4a2e, herb: true },
  sanqi:       { id: "sanqi",       name: "三七",     seedPrice: 0, sellPrice: 180, yields: 1, growMs: 280_000, unlockLevel: 1, xp: 28, body: 0xd8c49a, leaf: 0x4f8a4a, herb: true },
  heshouwu:    { id: "heshouwu",    name: "何首乌",   seedPrice: 0, sellPrice: 190, yields: 1, growMs: 290_000, unlockLevel: 1, xp: 29, body: 0x7a4a3a, leaf: 0x5f8f4a, herb: true },
  wuweizi:     { id: "wuweizi",     name: "五味子",   seedPrice: 0, sellPrice: 170, yields: 1, growMs: 280_000, unlockLevel: 1, xp: 27, body: 0xd03a48, leaf: 0x5a8f45, herb: true },
  tianma:      { id: "tianma",      name: "天麻",     seedPrice: 0, sellPrice: 200, yields: 1, growMs: 300_000, unlockLevel: 1, xp: 30, body: 0xe8d8b0, leaf: 0x8a7a4a, herb: true },
  duzhong:     { id: "duzhong",     name: "杜仲",     seedPrice: 0, sellPrice: 150, yields: 1, growMs: 260_000, unlockLevel: 1, xp: 26, body: 0x6f8f5a, leaf: 0x4f7a3a, herb: true },
  rougui:      { id: "rougui",      name: "肉桂",     seedPrice: 0, sellPrice: 170, yields: 1, growMs: 280_000, unlockLevel: 1, xp: 27, body: 0x9a5a3a, leaf: 0x3f6f3a, herb: true },
  fuling:      { id: "fuling",      name: "茯苓",     seedPrice: 0, sellPrice: 160, yields: 1, growMs: 270_000, unlockLevel: 1, xp: 26, body: 0xe8e2d0, leaf: 0x8a7a5a, herb: true },
  shanzhuyu:   { id: "shanzhuyu",   name: "山茱萸",   seedPrice: 0, sellPrice: 150, yields: 1, growMs: 260_000, unlockLevel: 1, xp: 26, body: 0xd03a3a, leaf: 0x5f8f48, herb: true },
  xuelian:     { id: "xuelian",     name: "雪莲",     seedPrice: 0, sellPrice: 200, yields: 1, growMs: 300_000, unlockLevel: 1, xp: 30, body: 0xf2eee0, leaf: 0x9ab0a0, herb: true },
};

export const CROP_LIST = Object.values(CROPS);
/** 商店里能买到种子的作物（野菜与草药都不卖种子） */
export const SHOP_CROPS = CROP_LIST.filter((crop) => !crop.wild && !crop.herb);
/** 全部野菜 */
export const WILD_GREENS = CROP_LIST.filter((crop) => crop.wild);
/** 全部草药 */
export const HERB_LIST = CROP_LIST.filter((crop) => crop.herb);

export function harvestKey(id: CropId, mutation: Mutation | null): string {
  return mutation ? `${id}:${mutation}` : id;
}

/** 三类作物各用各的变异池：草药五行/仙品/神品，野菜阴阳/长生，普通作物元素/精灵 */
export function cropMutationValid(id: CropId, mutation: Mutation | null): boolean {
  if (!mutation) return true;
  const def = CROPS[id];
  if (def.herb) return isHerbMutation(mutation);
  if (def.wild) return isWildMutation(mutation);
  return !isWildMutation(mutation) && !isHerbMutation(mutation);
}

export function produceName(crop: CropDef, mutation: Mutation | null): string {
  if (!mutation) return crop.name;
  return isSpirit(mutation) ? `${MUTATIONS[mutation].label}（${crop.name}）` : MUTATIONS[mutation].label + crop.name;
}

export function producePrice(crop: CropDef, mutation: Mutation | null): number {
  return crop.sellPrice * (mutation ? MUTATIONS[mutation].multiplier : 1);
}

const varieties: (Mutation | null)[] = [null, ...Object.keys(MUTATIONS) as Mutation[]];
const produce = CROP_LIST.flatMap((crop) => varieties.map((mutation) => ({
  key: harvestKey(crop.id, mutation),
  crop,
  mutation,
  name: produceName(crop, mutation),
  price: producePrice(crop, mutation),
})));

export function harvestLots(harvest: Record<string, number>) {
  return produce.filter((item) => harvest[item.key] > 0)
    .map((item) => ({ ...item, count: harvest[item.key] }));
}

export function harvestValue(harvest: Record<string, number>): number {
  return harvestLots(harvest).reduce((sum, item) => sum + item.price * item.count, 0);
}

/** 等级阈值：index 即等级 - 1 */
export const LEVEL_XP = [0, 30, 80, 150, 250, 400, 600, 850, 1150, 1550, 2050, 2700];

export function levelFromXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i += 1) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  return level;
}

export function nextLevelXp(level: number): number | null {
  return LEVEL_XP[level] ?? null;
}