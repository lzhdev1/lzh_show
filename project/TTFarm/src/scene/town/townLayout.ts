/**
 * 河东大城：道路、街区、建筑、门店与行人节点的唯一事实源。单位米，地面 y=0。
 *
 * 路网：两条东西向大道（主大道 z=52、北大道 z=110）与两条南北向街道
 * （中央街 x=82、东街 x=126）正交，形成四个十字路口。
 * 旧城（x44~120 / z22~96）的建筑坐标尽量保留，北城与东街补新楼。
 */

export type TownFace = "+z" | "-z" | "+x" | "-x";

/** 门店本地 +z 正面朝向世界方向时的 Y 轴旋转 */
export function townFaceYaw(face: TownFace): number {
  return face === "+z" ? 0 : face === "-z" ? Math.PI : face === "+x" ? Math.PI / 2 : -Math.PI / 2;
}

/** 点是否落在带朝向的门店/建筑内（本地坐标判定） */
export function insideFacingRect(px: number, pz: number, x: number, z: number, w: number, d: number, face: TownFace, inset = 0): boolean {
  const yaw = townFaceYaw(face);
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const dx = px - x, dz = pz - z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= w / 2 - inset && Math.abs(lz) <= d / 2 - inset;
}

export interface AvenueDef {
  id: string;
  z: number;
  x0: number; x1: number;
  half: number;
}
export interface CrossDef {
  id: string;
  x: number;
  z0: number; z1: number;
  half: number;
}

export const AVENUES: AvenueDef[] = [
  { id: "main", z: 52, x0: 42.6, x1: 140, half: 3.6 },
  { id: "north", z: 110, x0: 46, x1: 140, half: 3.4 },
  // 城南滨水街：把河对岸原先的空白草坡接进城区
  { id: "south", z: 19.5, x0: 50, x1: 100, half: 3.2 },
];
export const CROSSES: CrossDef[] = [
  // 中央街南延到滨水街，和新街区连成一片
  { id: "central", x: 82, z0: 10, z1: 140, half: 3.6 },
  { id: "east", x: 126, z0: 22, z1: 140, half: 3.4 },
];

export const TOWN = {
  bounds: { x0: 44, x1: 140, z0: 9, z1: 140 },
  avenue: AVENUES[0],
  cross: CROSSES[0],
  avenues: AVENUES,
  crosses: CROSSES,
  sidewalk: 2.0,
  curb: 0.26,
} as const;

/** 人行道中心线：路心 ±(半路宽 + 1.0) */
export const WALK = {
  avenueSouthZ: 47.4,
  avenueNorthZ: 56.6,
  crossWestX: 77.4,
  crossEastX: 86.6,
  northSouthZ: 105.4,
  northNorthZ: 114.6,
  eastWestX: 121.4,
  eastEastX: 130.6,
  southSouthZ: 15.3,
  southNorthZ: 23.7,
} as const;

export const ROAD_Y = 0.06;
export const WALK_Y = 0.14;
export const PLAZA_Y = 0.12;

export interface TowerDef {
  id: string;
  x: number; z: number; w: number; d: number; h: number;
  color: number; accent: number; face: TownFace;
}

export interface ShopDef {
  id: string;
  name: string;
  x: number; z: number; w: number; d: number; h: number;
  color: number; accent: number; face: TownFace;
  /** 门店类型只影响门头小物件，不改变主体 */
  kind?: "bakery" | "tea" | "cafe" | "book" | "grocery" | "flower" | "garage" | "tailor" | "food" | "mart24" | "laundry" | "nightfood";
  /** 可进入建筑：内置货架、冷柜、收银台，门前留 2m 门洞 */
  enterable?: "mart24";
}

export const TOWERS: TowerDef[] = [
  // —— 旧城 ——
  { id: "tower-a", x: 56, z: 72, w: 12, d: 12, h: 30, color: 0xe0d2bc, accent: 0xb96f4d, face: "-z" },
  { id: "tower-b", x: 69.5, z: 83.5, w: 10, d: 10, h: 22, color: 0xcbd3bf, accent: 0x5f7f80, face: "-z" },
  { id: "tower-c", x: 104, z: 76, w: 14, d: 14, h: 36, color: 0xe6d7bd, accent: 0x6d8d9c, face: "-z" },
  { id: "tower-d", x: 112, z: 36, w: 12, d: 9, h: 20, color: 0xc98d70, accent: 0x8a5a42, face: "+z" },
  // —— 北城 ——
  { id: "tower-e", x: 56, z: 96, w: 12, d: 9, h: 26, color: 0xdccdb7, accent: 0x8f6d55, face: "-z" },
  { id: "tower-f", x: 104, z: 128, w: 13, d: 11, h: 34, color: 0xd7d2c1, accent: 0x526d7c, face: "-z" },
  { id: "tower-g", x: 59, z: 128, w: 9, d: 10, h: 22, color: 0xd8bfa5, accent: 0x97694d, face: "+z" },
  // —— 东街尾 ——
  { id: "tower-h", x: 136, z: 98, w: 7, d: 10, h: 24, color: 0xcad2c4, accent: 0x5c7468, face: "-x" },
  // —— 东街补建：把 x126~140 的空街区填满 ——
  { id: "tower-east-a", x: 134, z: 25, w: 7, d: 5, h: 27, color: 0xe2d5c0, accent: 0x8d6750, face: "-x" },
  { id: "tower-east-b", x: 134, z: 91.5, w: 7, d: 5, h: 29, color: 0xd3d8ca, accent: 0x5c7468, face: "-x" },
];

/** 中层公寓：填街区纵深，楼高 12~16m，带阳台，和塔楼拉开层次 */
export const MIDRISES: TowerDef[] = [
  { id: "mid-nw", x: 70, z: 70, w: 7, d: 7, h: 15, color: 0xd8c6ab, accent: 0x7d6a58, face: "-z" },
  { id: "mid-ne", x: 93, z: 70, w: 6, d: 7, h: 14, color: 0xc9c2b4, accent: 0x6e7a78, face: "-x" },
  { id: "mid-sw", x: 52, z: 30, w: 9, d: 8, h: 12, color: 0xd3bda6, accent: 0x8a6752, face: "+z" },
  { id: "mid-north-a", x: 70, z: 98, w: 7, d: 6, h: 14, color: 0xd4c8b1, accent: 0x7e705c, face: "-z" },
  { id: "mid-north-b", x: 92, z: 98, w: 6, d: 7, h: 15, color: 0xc9cbbc, accent: 0x687669, face: "-z" },
  { id: "mid-north-c", x: 92, z: 134, w: 6, d: 6, h: 13, color: 0xd7c2a8, accent: 0x896b52, face: "+z" },
  { id: "mid-east", x: 136, z: 66, w: 6, d: 8, h: 13, color: 0xd2c7b6, accent: 0x74685a, face: "-x" },
  // —— 东街与北城补建 ——
  { id: "mid-east-a", x: 134, z: 31.5, w: 6, d: 5, h: 14, color: 0xd8c9b2, accent: 0x7b6b58, face: "-x" },
  { id: "mid-east-b", x: 134, z: 85.5, w: 6, d: 5, h: 15, color: 0xcfd3c4, accent: 0x65756a, face: "-x" },
  { id: "mid-east-c", x: 133.5, z: 120.5, w: 6, d: 6, h: 14, color: 0xdcc8ae, accent: 0x85664f, face: "-x" },
  { id: "mid-east-d", x: 133.5, z: 134, w: 6, d: 6, h: 16, color: 0xcdd3c9, accent: 0x5e756c, face: "-x" },
  { id: "mid-north-w", x: 48, z: 128, w: 6, d: 7, h: 15, color: 0xd6bfa7, accent: 0x8c604b, face: "+x" },
  { id: "mid-north-e", x: 122, z: 131, w: 6, d: 6, h: 15, color: 0xd1c5b3, accent: 0x74695a, face: "-z" },
  // —— 城南滨水街区：填掉河对岸原先空着的草坡 ——
  { id: "mid-south-a", x: 62, z: 26.6, w: 6, d: 3.6, h: 13, color: 0xd5c3aa, accent: 0x8b6a52, face: "+z" },
  { id: "mid-south-b", x: 94, z: 26.6, w: 6, d: 3.6, h: 12, color: 0xcbd1c4, accent: 0x63786d, face: "+z" },
  { id: "mid-south-c", x: 104, z: 12.3, w: 7, d: 3.8, h: 12, color: 0xd9c2a6, accent: 0x88634c, face: "+z" },
];

export const SHOPS: ShopDef[] = [
  // —— 旧城主大道两侧 ——
  { id: "shop-bread", name: "早禾面包", x: 51, z: 60.5, w: 9, d: 5, h: 7.4, color: 0xe8d3b0, accent: 0xc4794f, face: "-z", kind: "bakery" },
  { id: "shop-tea", name: "云记茶铺", x: 61.5, z: 60.5, w: 9, d: 5, h: 7.8, color: 0xcdd9b6, accent: 0x5d8a74, face: "-z", kind: "tea" },
  { id: "shop-cafe", name: "街角咖啡", x: 93, z: 60.5, w: 8, d: 5, h: 7.2, color: 0xe2c9a9, accent: 0x8a5c3b, face: "-z", kind: "cafe" },
  { id: "shop-book", name: "三页书店", x: 103, z: 60.5, w: 9, d: 5, h: 7.8, color: 0xb8c7cf, accent: 0x546b78, face: "-z", kind: "book" },
  { id: "shop-grocery", name: "杂货铺", x: 114, z: 60.5, w: 8, d: 5, h: 7.0, color: 0xdcc7a2, accent: 0x9a6a3c, face: "-z", kind: "grocery" },
  { id: "shop-flower", name: "花间花店", x: 49.5, z: 42.8, w: 8, d: 5.6, h: 7.2, color: 0xdccab8, accent: 0xb06a62, face: "+z", kind: "flower" },
  { id: "shop-garage", name: "老周修车", x: 59.5, z: 42.8, w: 9, d: 5.6, h: 7.0, color: 0xc7cdc9, accent: 0x5e6e6a, face: "+z", kind: "garage" },
  { id: "shop-food", name: "晚风食堂", x: 73, z: 31, w: 6, d: 8, h: 7.4, color: 0xe5d2b4, accent: 0xbd7a4e, face: "+x", kind: "food" },
  { id: "shop-tailor", name: "一针裁缝铺", x: 91.2, z: 32, w: 5, d: 7, h: 7.2, color: 0xd8c6c0, accent: 0x8f5f63, face: "-x", kind: "tailor" },
  { id: "shop-soy", name: "山泉豆浆", x: 91.2, z: 41, w: 5, d: 7, h: 7.6, color: 0xe9ddbe, accent: 0xa8865a, face: "-x", kind: "food" },
  { id: "shop-rice", name: "青禾米铺", x: 99, z: 44, w: 7, d: 4, h: 6.4, color: 0xd6c49f, accent: 0x7c6a42, face: "+z", kind: "grocery" },

  // —— 北大道南侧（面朝 +z） ——
  { id: "shop-noodle", name: "一碗面馆", x: 50, z: 101, w: 8, d: 5, h: 7.6, color: 0xe6d2b4, accent: 0xb56f4b, face: "+z", kind: "food" },
  { id: "shop-fruit", name: "四季鲜果", x: 61, z: 101, w: 8, d: 5, h: 7.2, color: 0xd9d3a6, accent: 0x82914d, face: "+z", kind: "grocery" },
  { id: "shop-bike", name: "两轮单车行", x: 72, z: 101, w: 6, d: 5, h: 6.8, color: 0xc4ccd0, accent: 0x5b6e75, face: "+z", kind: "garage" },
  { id: "shop-northcafe", name: "北街咖啡", x: 92, z: 101, w: 8, d: 5, h: 7.4, color: 0xe4d0b2, accent: 0x8b5d3d, face: "+z", kind: "cafe" },
  { id: "shop-pharmacy", name: "百草药铺", x: 103, z: 101, w: 8, d: 5, h: 7.6, color: 0xd8d5c1, accent: 0x6f7d5e, face: "+z", kind: "grocery" },
  { id: "shop-hardware", name: "老铁五金", x: 115, z: 101, w: 7, d: 5, h: 7.0, color: 0xc9c6bb, accent: 0x62645c, face: "+z", kind: "garage" },

  // —— 北大道北侧（面朝 -z） ——
  { id: "shop-dumpling", name: "巷口饺子", x: 58, z: 120, w: 9, d: 6, h: 8.0, color: 0xe8d6b8, accent: 0xb9794f, face: "-z", kind: "food" },
  { id: "shop-toys", name: "小满玩具", x: 70, z: 120, w: 7, d: 6, h: 7.2, color: 0xd8c8d8, accent: 0x8c608c, face: "-z", kind: "book" },
  { id: "shop-barber", name: "青丝理发", x: 90, z: 120, w: 7, d: 6, h: 7.0, color: 0xc7d2d4, accent: 0x557072, face: "-z", kind: "tailor" },
  { id: "shop-mart-b", name: "北街 24H", x: 101, z: 121, w: 7, d: 9, h: 7.8, color: 0xe9e3cf, accent: 0x4d7d72, face: "-z", kind: "mart24", enterable: "mart24" },
  { id: "shop-florist-n", name: "北岸花房", x: 114, z: 120, w: 7, d: 6, h: 7.2, color: 0xdccbb9, accent: 0xa86c63, face: "-z", kind: "flower" },

  // —— 东街（面朝 -x） ——
  { id: "shop-mart-a", name: "东街 24H", x: 135, z: 40, w: 6, d: 9, h: 7.6, color: 0xe7dfcb, accent: 0x4c7a6d, face: "-x", kind: "mart24", enterable: "mart24" },
  { id: "shop-laundry", name: "净衣洗衣", x: 135, z: 57, w: 6, d: 8, h: 6.8, color: 0xd2dce0, accent: 0x5c7580, face: "-x", kind: "laundry" },
  { id: "shop-nightfood", name: "灯火夜宵", x: 135, z: 75, w: 6, d: 8, h: 7.2, color: 0xe4c9a9, accent: 0xaa6b3e, face: "-x", kind: "nightfood" },

  // —— 东街中段与北城补店 ——
  { id: "shop-east-c", name: "东街水果", x: 134, z: 80, w: 4, d: 3.5, h: 6.8, color: 0xdfd2a8, accent: 0x7f904f, face: "-x", kind: "grocery" },
  { id: "shop-east-e", name: "东街小铺", x: 134, z: 127, w: 5.5, d: 4, h: 7.0, color: 0xdcc7a2, accent: 0x9a6a3c, face: "-x", kind: "grocery" },
  { id: "shop-north-w", name: "北门花店", x: 48, z: 136, w: 6, d: 4, h: 7.0, color: 0xdccab8, accent: 0xb06a62, face: "+x", kind: "flower" },
  { id: "shop-south-e", name: "南街茶点", x: 118, z: 27, w: 5, d: 4, h: 6.8, color: 0xcdd9b6, accent: 0x5d8a74, face: "-x", kind: "tea" },

  // —— 城南滨水街南侧（面朝 +z，一排临河店面） ——
  { id: "shop-river-a", name: "河风鱼铺", x: 57, z: 12.3, w: 7, d: 4, h: 7.2, color: 0xc7d7d2, accent: 0x537877, face: "+z", kind: "food" },
  { id: "shop-river-b", name: "渡口杂货", x: 67, z: 12.3, w: 7, d: 4, h: 7.0, color: 0xdcc7a2, accent: 0x9a6a3c, face: "+z", kind: "grocery" },
  { id: "shop-river-c", name: "南岸茶摊", x: 75, z: 12.3, w: 5.5, d: 4, h: 6.9, color: 0xcdd9b6, accent: 0x5d8a74, face: "+z", kind: "tea" },
  { id: "shop-river-d", name: "滨水花房", x: 90, z: 12.3, w: 7, d: 4, h: 7.3, color: 0xdccab8, accent: 0xb06a62, face: "+z", kind: "flower" },

  // —— 西岸临河一排小铺：从售货大厅望向对岸时把河岸线填满 ——
  { id: "shop-riverfront-a", name: "河岸茶棚", x: 46, z: 24.5, w: 5, d: 2.6, h: 5.8, color: 0xcdd9b6, accent: 0x5d8a74, face: "-x", kind: "tea" },
  { id: "shop-riverfront-b", name: "渡口小卖", x: 46, z: 30, w: 5, d: 2.6, h: 6.0, color: 0xdcc7a2, accent: 0x9a6a3c, face: "-x", kind: "grocery" },
  { id: "shop-riverfront-c", name: "柳岸花摊", x: 46, z: 36, w: 5, d: 2.6, h: 5.7, color: 0xdccab8, accent: 0xb06a62, face: "-x", kind: "flower" },
];

export const POCKET_PARK = { x: 115.5, z: 70, radius: 4.2 } as const;

export const DEALERSHIP = {
  id: "dealership",
  name: "星野汽车",
  x: 70, z: 41, w: 12, d: 10, h: 9.2,
  color: 0xf0e4cf, accent: 0x3f5562, glass: 0xbfe0e6,
  /** 北面 z=46 玻璃门的门洞中心与净宽 */
  doorX: 72.6, doorWidth: 2.2,
  /** 东面 x=76 朝中央街的自动门：门洞中心 z 与净宽 */
  eastDoorZ: 41.4, eastDoorWidth: 2.4,
} as const;

/** 街区块铺装（整块铺地，避免楼间露出草地） */
export const PLAZAS: Array<{ x0: number; x1: number; z0: number; z1: number }> = [
  // 旧城四块
  { x0: 44.5, x1: 76.4, z0: 57.6, z1: 104.4 },
  { x0: 87.6, x1: 120, z0: 57.6, z1: 104.4 },
  { x0: 44.5, x1: 76.4, z0: 22, z1: 46.4 },
  { x0: 87.6, x1: 120, z0: 22, z1: 46.4 },
  // 北城两块
  { x0: 44.5, x1: 76.4, z0: 115, z1: 140 },
  { x0: 87.6, x1: 120, z0: 115, z1: 140 },
  // 东街窄街区
  { x0: 130.6, x1: 140, z0: 22, z1: 46.4 },
  { x0: 130.6, x1: 140, z0: 57.6, z1: 104.4 },
  { x0: 130.6, x1: 140, z0: 115, z1: 140 },
  // 城南滨水街两侧：南侧临河店面铺地，北侧接旧城南缘
  { x0: 54, x1: 78, z0: 10.4, z1: 14.3 },
  { x0: 86, x1: 100, z0: 10.4, z1: 14.3 },
  { x0: 100.4, x1: 110, z0: 10.4, z1: 14.3 },
  { x0: 50, x1: 76, z0: 23.7, z1: 28.5 },
  { x0: 86, x1: 100, z0: 23.7, z1: 28.5 },
];

/** 街区外沿与城镇边界：树木/石头/草丛的排除区 */
export function inTown(x: number, z: number): boolean {
  if (x >= 44 && x <= 141 && z >= 9 && z <= 141) return true;
  // 主大道向西接桥的一小段
  if (x >= 42 && x <= 142 && z >= 47.4 && z <= 56.6) return true;
  return false;
}

/** 是否落在柏油路上（行人与装饰用） */
export function onRoad(x: number, z: number): boolean {
  for (const a of AVENUES) {
    if (x >= a.x0 && x <= a.x1 && Math.abs(z - a.z) <= a.half) return true;
  }
  for (const c of CROSSES) {
    if (Math.abs(x - c.x) <= c.half && z >= c.z0 && z <= c.z1) return true;
  }
  return false;
}

/** 人行道带：路口四角 2×2 的转角板也包含在内 */
function onSidewalk(x: number, z: number): boolean {
  for (const a of AVENUES) {
    if (x >= a.x0 && x <= a.x1) {
      if (Math.abs(z - (a.z - a.half - 1)) <= 1) return true;
      if (Math.abs(z - (a.z + a.half + 1)) <= 1) return true;
    }
  }
  for (const c of CROSSES) {
    if (z >= c.z0 && z <= c.z1) {
      if (Math.abs(x - (c.x - c.half - 1)) <= 1) return true;
      if (Math.abs(x - (c.x + c.half + 1)) <= 1) return true;
    }
  }
  return false;
}

/** 玩家/行人在城镇里的落脚高度；人行道最高、广场次之、车道最低 */
export function townSurfaceHeight(x: number, z: number): number {
  if (onSidewalk(x, z)) return WALK_Y;
  for (const p of PLAZAS) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return PLAZA_Y;
  if (onRoad(x, z)) return ROAD_Y;
  return 0;
}

export interface RouteNode { x: number; z: number; }

/** 行人节点图：四条大道/街道的人行道 + 每个路口的四条斑马线连接。 */
export function walkNodes(): { nodes: RouteNode[]; links: Array<[number, number]> } {
  const nodes: RouteNode[] = [];
  const links: Array<[number, number]> = [];
  const ids = new Map<string, number>();
  const key = (x: number, z: number) => `${x.toFixed(2)},${z.toFixed(2)}`;
  const push = (x: number, z: number) => {
    const k = key(x, z);
    const existing = ids.get(k);
    if (existing !== undefined) return existing;
    nodes.push({ x, z });
    const id = nodes.length - 1;
    ids.set(k, id);
    return id;
  };
  const connect = (a: number, b: number) => links.push([a, b]);

  // 每条大道的人行道：在街角处补节点，保证路口四角都有落脚点
  const avenueWalkZ = AVENUES.flatMap(a => [a.z - a.half - 1, a.z + a.half + 1]);
  const crossWalkX = CROSSES.flatMap(c => [c.x - c.half - 1, c.x + c.half + 1]);
  const xs: number[] = [];
  for (let x = 46; x <= 138; x += 7) xs.push(x);
  for (const x of crossWalkX) xs.push(x);
  const uniqueXs = [...new Set(xs.map(v => Math.round(v * 100) / 100))].sort((a, b) => a - b);

  for (const a of AVENUES) {
    for (const z of [a.z - a.half - 1, a.z + a.half + 1]) {
      const line = uniqueXs.filter(x => x >= a.x0 + 1.5 && x <= a.x1 - 1.5).map(x => push(x, z));
      for (let i = 0; i < line.length - 1; i++) connect(line[i], line[i + 1]);
    }
  }

  // 每条街道的人行道
  const zs: number[] = [];
  for (let z = 24; z <= 138; z += 7) zs.push(z);
  for (const z of avenueWalkZ) zs.push(z);
  const uniqueZs = [...new Set(zs.map(v => Math.round(v * 100) / 100))].sort((a, b) => a - b);
  for (const c of CROSSES) {
    for (const x of [c.x - c.half - 1, c.x + c.half + 1]) {
      const line = uniqueZs.filter(z => z >= c.z0 + 1.5 && z <= c.z1 - 1.5).map(z => push(x, z));
      for (let i = 0; i < line.length - 1; i++) connect(line[i], line[i + 1]);
    }
  }

  // 四个路口：每个角两条跨路连接，形成斑马线环
  for (const a of AVENUES) {
    for (const c of CROSSES) {
      const zS = a.z - a.half - 1, zN = a.z + a.half + 1;
      const xW = c.x - c.half - 1, xE = c.x + c.half + 1;
      const sw = push(xW, zS), se = push(xE, zS), nw = push(xW, zN), ne = push(xE, zN);
      connect(sw, nw); connect(se, ne);
      connect(sw, se); connect(nw, ne);
    }
  }

  return { nodes, links };
}

/** 所有路口坐标：信号灯、斑马线与车辆停车线共用 */
export const INTERSECTIONS = AVENUES.flatMap(a => CROSSES.map(c => ({
  x: c.x, z: a.z, avenue: a, cross: c,
})));
