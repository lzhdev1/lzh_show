export const COUTURE = [
  {id:"petal-waltz", name:"蜜樱圆舞", family:"petal", swatch:"#f5a8b8", detail:"蜜粉缎面向内收成花苞短裙，奶油色褶带从莓红腰侧绕过肩头。"},
  {id:"rose-cadenza", name:"绯蔷咏叹", family:"petal", swatch:"#ab3659", detail:"绯红半幅拖裙在酒红内裙一侧敞开，转身时翻出蔷薇粉衬边。"},
  {id:"peach-fan", name:"桃扇春灯", family:"petal", swatch:"#ffb7a0", detail:"桃色交领短夹克下露出青瓷腰封，杏金与珊瑚色的扇褶偏向一侧。"},
  {id:"lilac-ballet", name:"丁香芭蕾", family:"petal", swatch:"#c6b0df", detail:"丁香束身衣以交叉系带收腰，长缎带沿着斜叠的薄纱垂到腿侧。"},
  {id:"champagne-bell", name:"铃兰香槟", family:"petal", swatch:"#ffedce", detail:"象牙色锥形长裙嵌着鼠尾草绿前幅，香槟翻领在背后展开为双片披风。"},
  {id:"tide-jelly", name:"潮汐水母", family:"tide", swatch:"#92dce7", detail:"雾蓝欧根纱向内收成灯笼罩裙，鸢紫斜领下垂着长短错落的卷曲飘带。"},
  {id:"azure-sail", name:"晴帆序曲", family:"tide", swatch:"#689fc2", detail:"双排扣海军短夹克配撞色刀褶裙，背后的水手领折出一道象牙白燕尾线。"},
  {id:"pearl-opera", name:"珠母咏叹", family:"tide", swatch:"#c3a6b4", detail:"珍珠白垂褶领连接斜裁鱼尾，藕紫缎面旋入拖尾，两道珠链垂过低背。"},
  {id:"mint-ripple", name:"薄荷涟漪", family:"tide", swatch:"#64bda9", detail:"薄荷绿与深青沿单肩和裹裙划出弧线，侧腰两幅丝巾绕向身后。"},
  {id:"glacier-lace", name:"冰棱夜曲", family:"tide", swatch:"#bddded", detail:"冰蓝披风从宽肩收向背后的菱形折片，前开襟露出靛蓝短裙。"},
  {id:"lunar-arc", name:"月弧银纱", family:"astral", swatch:"#aac8df", detail:"雾蓝斜裁长裙从单肩垂到脚踝，银月肩扣收拢缎面与薄纱披巾。"},
  {id:"violet-nocturne", name:"紫罗夜曲", family:"astral", swatch:"#755e80", detail:"紫黑燕尾小西装配丁香短裙，缎面戗驳领上系着蝶结，贝雷帽斜扣发间。"},
  {id:"aurora-prism", name:"极光棱镜", family:"astral", swatch:"#8ed8cd", detail:"薄荷与鸢尾紫斜裙错落交叠，背后两对折叠欧根纱翼向肩外舒展。"},
  {id:"meteor-idol", name:"流星进行曲", family:"astral", swatch:"#637db0", detail:"蓝色飞行短夹克罩住银色束腰马甲，撞色箱褶裙呼应金属耳机。"},
  {id:"dusk-orbit", name:"暮金星轨", family:"astral", swatch:"#c97065", detail:"蜜金到夕橘的螺旋荷叶边绕过酒红单肩裙，肩头缀着一朵折叠丝花。"},
  {id:"butterfly-veil", name:"蝶羽星纱", family:"petal", swatch:"#f6b7c9", detail:"蜜粉珠绣心形领胸衣束住薄雾长裙，开襟星纱外袍与及地大袖被裙摆的粉蝶和碎光托起。"},
] as const;

export type CoutureId = (typeof COUTURE)[number]["id"];
export type CoutureFamily = (typeof COUTURE)[number]["family"];
const ids: ReadonlySet<unknown> = new Set(COUTURE.map(s=>s.id));
export const isCouture = (value:unknown): value is CoutureId => ids.has(value);
