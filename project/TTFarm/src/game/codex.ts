import { CROPS, type CropId } from "./crops";
import { FISH_LIST, FISH_RARITY, type FishSpecies } from "./fish";
import { ANIMALS, MOUNT_SPECIES, MOUNT_UNLOCK_LEVEL, isHorseSpecies, type AnimalSpecies } from "./ranch";
import { HERB_MUTATIONS, MUTATIONS, type Mutation } from "./weather";
import { MUSHROOM_LIST } from "./mushrooms";

/**
 * 图鉴数据：游戏里全部作物、野菜、变异与动物，以及它们之间的引诱关系。
 * 数值（价格 / 收成 / 生长时间 / 倍率 / 坐骑条件）一律从 crops.ts、weather.ts、ranch.ts 现取，
 * 这里只维护“文案”和“关系”，改数值时图鉴自动跟着变。
 */

export type CodexTab = "crop" | "wild" | "herb" | "mutation" | "animal" | "fish" | "mushroom";

export interface FishEntry {
  fish: FishSpecies;
  rarity: { label: string; color: string };
}

/** 鱼类图鉴直接读 fish.ts，价格、稀有度和简介永远与钓鱼数据一致。 */
export const CODEX_FISH: readonly FishEntry[] = FISH_LIST.map((fish) => ({
  fish,
  rarity: FISH_RARITY[fish.rarity],
}));

/** 菌类图鉴直接读蘑菇数据，一百种按稀有度与宿主分组展示。 */
export const CODEX_MUSHROOMS = MUSHROOM_LIST;

export const ANIMAL_PORTRAITS: Record<AnimalSpecies, string> = {
  wolf: "🐺", bear: "🐻", tiger: "🐯", lion: "🦁", elephant: "🐘", panda: "🐼", fox: "🦊",
  rabbit: "🐇", deer: "🦌", boar: "🐗", goat: "🐐", alpaca: "🦙", sheep: "🐑", horse: "🐴",
  flameHorse: "🔥",
  cow: "🐄", raccoon: "🦝", redPanda: "🐾", penguin: "🐧", duck: "🦆", crane: "🪶",
};

/** 普通作物的风味与用途 */
const CROP_BLURB: Record<string, string> = {
  radish: "根脆微甜、四十秒就能起一茬，是新手田里最稳的口粮。甜味最能招来兔子、大象、羊驼和野马。",
  cabbage: "叶片肥厚、耐寒好养，一颗能剥两层收成。清甜的气味是熊猫、梅花鹿、山羊和绵羊的最爱。",
  tomato: "藤上挂果、酸甜多汁，一次能收三份。红果的味道能引来灰狼、浣熊和丹顶鹤。",
  corn: "杆高穗大，掰下来就是硬通货。烤玉米的香气能引狮子、花牛、企鹅和绿头鸭。",
  strawberry: "低矮的浆果丛，摘一次收三份，是前期性价比最高的作物之一。甜香最容易勾住棕熊、赤狐和小熊猫。",
  pumpkin: "藤蔓铺地、单个最压秤，早期作物里卖价最高。甜糯味能引老虎和野猪。",
  eggplant: "紫皮油亮、结果勤，适合中期稳定出货。味道寡淡，野生动物不太买账。",
  bean: "一架能连摘四份，是份数最多的作物，适合快速冲经验。青豆气味清淡，不招野兽。",
  chili: "红椒辛辣、单价不低，但很少被野兽惦记。刺激的味道连馋嘴动物都退避三舍。",
  watermelon: "瓜大汁多、生长期长，是夏天的现金作物。皮厚，野兽闻得到却拱不动。",
  peach: "树上结的软果，香气足、卖价高，和梨同期解锁。香气浓，但果期短，野兽赶不上。",
  pear: "清甜多汁，成熟期与桃子接近，适合搭配排产。气味淡，不招惹野生动物。",
  apricot: "橙黄小果，成熟比同期的枣更快，适合填补出货空档。酸香不浓，野兽不感兴趣。",
  jujube: "红枣耐放、卖价稳，是七级档里的安心选择。甜味内敛，不引兽。",
  tulip: "观赏花卉，一朵能卖过一筐菜，是八级以后的主要收入来源。花期短，别错过收获窗口。",
  lily: "白花清雅、单价高，适合和郁金香轮种。香气清冷，不招动物。",
  roseRed: "六色玫瑰之一，花瓣可制香，卖价在花卉里最高一档。带刺，野兽不碰。",
  rosePink: "粉色花瓣柔和，是花束订单的常客。带刺，野兽不碰。",
  roseWhite: "素白花瓣最百搭，做花束和香料都合适。带刺，野兽不碰。",
  roseYellow: "明黄花色讨喜，节庆花束的常用主花。带刺，野兽不碰。",
  roseBlue: "冷调蓝玫瑰最难培育，十级才能播种，是收藏向的高价花。带刺，野兽不碰。",
  rosePurple: "深紫瓣色浓，适合做压轴花束。带刺，野兽不碰。",
  pineapple: "热带果，长得慢但单价高，十一级解锁。酸甜味浓，可惜皮太硬，野兽啃不动。",
  durian: "气味霸道、单价最高，是后期的压轴作物。味道太冲，野生动物反而躲着走。",
};

/** 野菜的风味与采法 */
const WILD_BLURB: Record<string, string> = {
  jicai: "早春第一茬，包饺子最香。种子只能靠野外采摘掉落，种回田里才有机会抽出阴阳或长生。",
  pugongying: "嫩叶微苦回甘，晒干还能泡茶。野外最常见的一味，适合新手先练手采摘。",
  machixian: "茎叶肥厚、酸溜爽口，凉拌最合适。贴地生长，采摘时注意别踩到河岸湿滑处。",
  juecai: "卷头嫩芽，焯水后炒腊肉是一绝。多长在背阴草坡，遇到就是运气。",
  xiangchun: "树梢嫩芽，香气霸道，炒蛋最搭。生长期长，采到种子值得优先种回田里。",
  yuqian: "榆树上的翅果，清甜带黏，做馅料很香。产量不高的时令货。",
  huaihua: "槐花清甜，拌面蒸食最经典。花期很短，采摘要趁早。",
  huihuicai: "叶背带粉、口感柔嫩，是救荒菜里的常客。田间地头都能长，采起来最省事。",
  yexiancai: "紫红叶心，炒出来汤汁发红，铁味足。喜欢湿润草地，河对岸的草甸上更多。",
  cheqiancao: "叶脉平行、贴地铺开，煮水清火。荒野路边最多，走两步就能遇到。",
  yuxingcao: "气味独特、根茎脆嫩，西南吃法最地道。阴湿处长得最好。",
  yebohe: "清凉提神，泡茶做酱都行。喜欢水边，常和野葱长在一块。",
  zisu: "紫叶香气浓，包烤肉、腌菜都离不开。田边向阳处最容易找到。",
  aicao: "艾香浓烈，做青团、熏屋都合用。草坡上一长就是一片。",
  yecong: "细叶辛香，炒蛋、烙饼都提味。喜欢疏松的草地，成簇生长。",
  yesuan: "蒜味清辣，腌渍后很下饭。比野葱更难找，遇到别错过。",
  shuiqin: "水边芹菜，脆嫩带清香，炒香干最搭。只长在河岸湿处，采完记得看脚下。",
  louhao: "蒿香清雅，炒腊肉、做汤都合适。河滩与湿草甸是它的地盘。",
  malantou: "紫茎嫩叶，焯水凉拌最香，江南春菜代表。喜欢成片长在草坡背阴面。",
  juhuanao: "菊叶清苦回甘，炒蛋或做汤都清新。农场门口就常能遇到。",
};

/** 草药的风味、药理与采法 */
const HERB_BLURB: Record<string, string> = {
  gouqi: "红果成串，晒干泡水最养眼。耐旱好活，野外灌木丛里常能采到。",
  longnaobohe: "叶面凉气重，揉碎有龙脑香。喜欢阴湿田边，采到就能种回药圃。",
  suye: "紫叶带清香，解表散寒。和紫苏同族但更偏药用，香气更沉。",
  qiai: "艾香厚实，端午前后最盛。叶背灰白，成片长在向阳草坡。",
  jinyinhua: "藤上并蒂开黄白小花，清热解毒。花期短，采到种子要赶紧种。",
  juhua: "头状花序层层叠叠，清肝明目。秋后开花，一朵能压住整株的香。",
  honghua: "橙红管状花，活血通经。花瓣带刺，采摘时记得戴手套。",
  huoxiang: "方茎对叶，气味辛香，化湿和胃。湿地边一长就是一片。",
  peilan: "叶细花香，醒脾开胃。比藿香更清雅，常长在溪畔草甸。",
  xiangru: "穗状小花带薄荷气，发汗解表。夏秋开花，野外石缝里也能扎根。",
  jingjie: "细叶紫穗，祛风解表。香气清烈，晒干后能存很久。",
  chenpi: "橘皮陈放三年才成药，理气化痰。矮橘树上结的果，晒干就是钱。",
  banxia: "三叶一苞，块茎入药，燥湿化痰。喜阴湿，采时别碰佛焰苞的汁水。",
  jiegeng: "紫铃状花，宣肺利咽。根粗如指，秋季采挖最饱满。",
  banlangen: "板蓝的根，清热解毒。叶可做青黛，一株两用，是药圃里的常客。",
  daqingye: "板蓝的大叶，鲜用清热。叶面蓝绿发亮，和板蓝根同株同源。",
  xiakucao: "夏至后花序枯黄，故名夏枯。紫穗层层，清火散结。",
  yimucao: "益母草，粉紫轮伞花序，活血调经。田埂荒地最常见。",
  juemingzi: "豆荚细长，籽粒明目。小灌木黄花，晒干后豆荚能存一年。",
  nvzhenzi: "女贞的紫黑小果，滋补肝肾。常绿小树，冬天也不落叶。",
  danggui: "伞形白花，根头肥厚，补血活血。气味浓，切开满屋药香。",
  huangqi: "黄芪直根深扎，豆科黄花成穗。补气固表，是药圃里的顶梁柱。",
  gancao: "甘草甜根，调和诸药。紫花总状，根皮红棕，嚼一口回甘很久。",
  danshen: "丹参紫红穗花，活血祛瘀。根皮赤红，是心血管方里的常客。",
  chuanxiong: "川芎伞花细碎，根茎香气冲鼻。活血行气，四川产的尤佳。",
  baishao: "白芍根粗皮白，养血柔肝。粉白花瓣，花开时药圃最好看。",
  huanglian: "黄连根茎金黄，味极苦，清热燥湿。喜阴凉，叶下藏着一串黄根。",
  huangqin: "黄芩紫花成穗，根心枯黄。清肺燥湿，老根比新根更值钱。",
  chaihu: "柴胡伞形黄花，解表退热。根细如须，一丛能挖出一小把。",
  fangfeng: "防风直根深长，伞花白绿。祛风胜湿，野外的风口处长得最壮。",
  duhuo: "独活大叶伞花，祛风止痛。根粗有香气，喜阴湿山坡。",
  qianghuo: "羌活茎紫花白，解表散寒。根茎带节，像一串小竹节。",
  baizhi: "白芷伞花雪白，根粗味香。祛风止痛，晒干切片能存很久。",
  baizhu: "白术块茎肥厚，健脾益气。紫花藏在宽叶下，秋后挖根最实。",
  cangzhu: "苍术根茎苍褐，燥湿健脾。叶宽花紫，喜向阳山坡。",
  sharen: "砂仁姜科穗花，果实带壳，化湿开胃。岭南药圃里的香气担当。",
  lianqiao: "连翘早春开黄花，果实清热解毒。枝条拱垂，是药圃里的报春树。",
  houpo: "厚朴树皮入药，行气燥湿。大叶白花，剥皮要选十年以上的老树。",
  shihu: "石斛附生兰，假鳞茎一节一节，滋阴清热。紫花小巧，喜阴湿石壁。",
  renshen: "五加科人参，掌状复叶配红果。根如人形，是药圃里最金贵的镇园之宝。",
  lingzhi: "灵芝菌盖赤褐有环纹，补气安神。喜老树根，一朵能长好几年。",
  sanqi: "三七块根带瘤节，止血化瘀。红果成簇，云南文山的最有名。",
  heshouwu: "何首乌藤蔓缠绕，块根黑褐，乌发益肾。藤上结的果像小三角。",
  wuweizi: "五味子藤本红果串，酸甘五味俱全。收敛固涩，藤蔓能爬满整架。",
  tianma: "天麻无叶，靠蜜环菌共生，根茎肥白。平肝息风，是兰科里的怪才。",
  duzhong: "杜仲树皮折断有银丝，补肝肾强筋骨。小乔木，叶背灰绿。",
  rougui: "肉桂树皮辛甜，温阳散寒。常绿小乔木，剥皮晒干卷成筒。",
  fuling: "茯苓菌核雪白，利水渗湿。长在松树根下，挖出来像一块白玉。",
  shanzhuyu: "山茱萸红果晶莹，补益肝肾。小乔木，秋后满树像挂了一串珊瑚。",
  xuelian: "雪莲头状花序包在白色绒毛里，高山才有。温肾壮阳，是药圃里最难养的一味。",
};

/** 变异的来源与效果 */
const MUTATION_BLURB: Record<string, string> = {
  thunder: "果实表面缠着紫色电弧，噼啪作响。普通作物播种时抽中，收成售价 ×2。",
  frost: "整株覆着一层薄霜，呵气成雾。普通作物播种时抽中，收成售价 ×2。",
  flame: "果实裹着橙红火舌，靠近能感到热浪。普通作物播种时抽中，收成售价 ×2。",
  gold: "果皮鎏金、颗颗沉手，是早期最值钱的变异。普通作物播种时抽中，售价 ×3。",
  earth: "果实带着土黄色的厚重光泽，落地能砸出浅坑。普通作物播种时抽中，售价 ×5。",
  wind: "果实轻得几乎没重量，周围一直有细风绕转。普通作物播种时抽中，售价 ×5。",
  rosette: "果实化成花庭舞姬·露茜的形象，是会走动的收成。精灵变异，售价 ×8。",
  nocturne: "果实化成月夜骑士·凛的形象，披风上落着星光。精灵变异，售价 ×8。",
  coral: "果实化成潮歌巫女·汐音的形象，水汽随她呼吸起伏。精灵变异，售价 ×8。",
  orbit: "果实化成星轨领航员·昴的形象，身周环着一圈轨道光点。精灵变异，售价 ×8。",
  bamboo: "果实化成竹林画师·青砚的形象，身边飘着水墨竹叶。精灵变异，售价 ×8。",
  amber: "旧版金穗变异，穗子像琥珀一样透亮。老存档里的收成仍然保留，售价 ×2。",
  mist: "旧版雾晶变异，果实外层裹着半透明的雾壳。老存档里的收成仍然保留，售价 ×3。",
  pearl: "旧版雨珠变异，果面挂着一层水光。老存档里的收成仍然保留，售价 ×2。",
  yinyang1: "植株半黑半白，白气与黑气对流，一颗柔光星辰绕着转。野菜专属，售价 ×4。",
  yinyang2: "黑白双分更彻底，两颗星辰反向环绕，光晕一明一暗。野菜专属，售价 ×8。",
  yinyang3: "整株阴阳流转不息，三颗星辰连成环，是野菜里的顶级变异。售价 ×16。",
  longlife1: "植株玉质化，翡翠云雾绕身，一条小金龙沿脊线游动。野菜专属，售价 ×5。",
  longlife2: "玉质更深，云雾里浮着光尘，两条金龙对游。野菜专属，售价 ×10。",
  longlife3: "整株如老玉生光，三条金龙首尾相逐，是野外最难得的收成。售价 ×20。",
  herbMetal: "植株镀上一层温润的金色，药香里带一点矿石气。草药五行变异，售价 ×4。",
  herbWood: "枝叶泛青翠灵光，像刚从春雨里拔出来。草药五行变异，售价 ×4。",
  herbWater: "叶面流动着水光，雾气压在根际。草药五行变异，售价 ×4。",
  herbFire: "花瓣与叶缘烧出一圈暖红，靠近能闻到焙药香。草药五行变异，售价 ×5。",
  herbEarth: "根茎裹着土黄宝光，沉甸甸压手。草药五行变异，售价 ×5。",
  xianpin: "云雾从根部层层升起，整株泛着细碎闪光，像被月光洗过。仙品草药，售价 ×15。",
  shenpin: "闪电在植株上游走，叶片与根茎烧成金黄，落地仍有余雷。神品草药，售价 ×30。",
};

/** 动物的性情与来历 */
const ANIMAL_BLURB: Record<AnimalSpecies, string> = {
  wolf: "成群巡游、鼻子极灵，隔着半片草地就能闻到番茄味。收服后巡逻范围很广。",
  bear: "慢吞吞但力气惊人，认准草莓就走不动路。收服后是牧场里最稳的劳力。",
  tiger: "独来独往、气场压人，南瓜的甜味是它唯一的软肋。五行变异后可作坐骑。",
  lion: "草坡上的王者，最爱啃玉米。五行变异后能驮着人跑。",
  elephant: "温和的巨兽，鼻子一卷能拔起整棵萝卜。五行变异后可作坐骑。",
  panda: "整天啃竹子，闻到白菜就走不动。五行变异后可作坐骑。",
  fox: "机警又爱偷吃，草莓熟了的季节最常出没。不适合骑乘，但很会看家。",
  rabbit: "胆子小、跑得快，萝卜是它的命门。不能骑，收服后只在牧场里蹦跳。",
  deer: "优雅易惊，白菜的清甜最能稳住它。不能骑乘，是牧场里的观赏担当。",
  boar: "拱地好手，南瓜地一夜能被翻个遍。不能骑，但力气大、性格倔。",
  goat: "爱爬高、什么都想啃一口，白菜最合它胃口。不能骑乘。",
  alpaca: "温顺亲人，毛能剪下来卖钱。最爱萝卜，不能骑乘。",
  sheep: "成群行动、毛厚实，白菜是它的日常口粮。不能骑乘。",
  horse: "脚力最好的野生动物，收服后不用变异就能骑，移速提升到 3 倍。萝卜就能引它过来。",
  flameHorse: "只在荒野深处出没的黑曜石神驹，鬃尾燃着不灭的焰纹。萝卜就能引它靠近，收服后直接进坐骑栏，移速与野马同为 3 倍。",
  cow: "性子慢、产奶稳，最爱玉米。不能骑乘，是牧场里的固定收益。",
  raccoon: "夜里翻垃圾的小偷，番茄的味道一闻就来。不能骑乘。",
  redPanda: "爱爬树、尾巴蓬松，草莓是它的心头好。不能骑乘，观赏性很强。",
  penguin: "走路摇摇晃晃、极爱水，玉米是它的主食。不能骑乘。",
  duck: "河边成群游，玉米撒下去就围过来。不能骑乘。",
  crane: "水边踱步、姿态最雅，番茄能把它引到岸边。不能骑乘。",
};

/** 每种作物会引来哪些动物（由 ANIMALS.favorite 反查，改配置自动同步） */
const LURE_BY_CROP = new Map<CropId, AnimalSpecies[]>();
for (const [species, def] of Object.entries(ANIMALS) as [AnimalSpecies, { name: string; favorite: CropId }][]) {
  const list = LURE_BY_CROP.get(def.favorite) ?? [];
  list.push(species);
  LURE_BY_CROP.set(def.favorite, list);
}

export interface PlantEntry {
  kind: "crop" | "wild" | "herb";
  crop: CropId;
  name: string;
  blurb: string;
  lures: { species: AnimalSpecies; name: string }[];
}

export interface MutationEntry {
  id: Mutation;
  label: string;
  blurb: string;
  multiplier: number;
  family: "element" | "spirit" | "legacy" | "wild" | "herb";
}

export interface AnimalEntry {
  species: AnimalSpecies;
  name: string;
  blurb: string;
  favorite: { crop: CropId; name: string };
  /** always：天生可骑；mutated：需要五行变异；never：不能骑 */
  mount: "always" | "mutated" | "never";
}

const ATTRACTION = (crop: CropId) => (LURE_BY_CROP.get(crop) ?? []).map((species) => ({
  species, name: ANIMALS[species].name,
}));

export const CODEX_PLANTS: readonly PlantEntry[] = Object.values(CROPS).map((crop) => ({
  kind: crop.herb ? "herb" as const : crop.wild ? "wild" as const : "crop" as const,
  crop: crop.id,
  name: crop.name,
  blurb: (crop.herb ? HERB_BLURB[crop.id] : crop.wild ? WILD_BLURB[crop.id] : CROP_BLURB[crop.id]) ?? "",
  lures: ATTRACTION(crop.id),
}));

const SPIRIT_IDS = ["rosette", "nocturne", "coral", "orbit", "bamboo"];
const LEGACY_IDS = ["amber", "mist", "pearl"];

export const CODEX_MUTATIONS: readonly MutationEntry[] = (Object.keys(MUTATIONS) as Mutation[]).map((id) => ({
  id,
  label: MUTATIONS[id].label,
  blurb: MUTATION_BLURB[id] ?? "",
  multiplier: MUTATIONS[id].multiplier,
  family: id.startsWith("yinyang") || id.startsWith("longlife") ? "wild" as const
    : (HERB_MUTATIONS as readonly string[]).includes(id) ? "herb" as const
    : (LEGACY_IDS as string[]).includes(id) ? "legacy" as const
    : (SPIRIT_IDS as string[]).includes(id) ? "spirit" as const : "element" as const,
}));

export const CODEX_ANIMALS: readonly AnimalEntry[] = (Object.keys(ANIMALS) as AnimalSpecies[]).map((species) => ({
  species,
  name: ANIMALS[species].name,
  blurb: ANIMAL_BLURB[species],
  favorite: { crop: ANIMALS[species].favorite, name: CROPS[ANIMALS[species].favorite].name },
  mount: isHorseSpecies(species) ? "always" as const : MOUNT_SPECIES.includes(species) ? "mutated" as const : "never" as const,
}));

/** 坐骑条件文案，RanchPanel 与图鉴共用同一套说辞 */
export const MOUNT_RULE = `牧场升到 ${MOUNT_UNLOCK_LEVEL} 级开启坐骑栏：野马和焰纹神驹收服即可骑乘（移速 3 倍），五行变异的狼、熊、虎、狮子、大象和熊猫也能骑。`;

export function mountLabel(entry: AnimalEntry): string {
  if (entry.mount === "always") return "可当坐骑 · 无需变异";
  if (entry.mount === "mutated") return "五行变异后可当坐骑";
  return "不可当坐骑";
}
