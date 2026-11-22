/** 河东小城：道路、街区、建筑、门店与行人节点的唯一事实源。单位米，地面 y=0。 */

export type TownFace = "+z" | "-z" | "+x" | "-x";

export const TOWN = {
  bounds: { x0: 44, x1: 120, z0: 26, z1: 92 },
  avenue: { x0: 42.6, x1: 122, z: 52, half: 3.6 },
  cross: { x: 82, z0: 22, z1: 96, half: 3.6 },
  sidewalk: 2.0,
  curb: 0.26,
} as const;

/** 人行道中心线：路心 ±4.6（3.6 半路宽 + 1.0 人行道中心偏移） */
export const WALK = {
  avenueSouthZ: 47.4,
  avenueNorthZ: 56.6,
  crossWestX: 77.4,
  crossEastX: 86.6,
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
  kind?: "bakery" | "tea" | "cafe" | "book" | "grocery" | "flower" | "garage" | "tailor" | "food";
}

export const TOWERS: TowerDef[] = [
  { id: "tower-a", x: 56, z: 72, w: 12, d: 12, h: 30, color: 0xe0d2bc, accent: 0xb96f4d, face: "-z" },
  { id: "tower-b", x: 69.5, z: 83.5, w: 10, d: 10, h: 22, color: 0xcbd3bf, accent: 0x5f7f80, face: "-z" },
  { id: "tower-c", x: 104, z: 76, w: 14, d: 14, h: 36, color: 0xe6d7bd, accent: 0x6d8d9c, face: "-z" },
  { id: "tower-d", x: 112, z: 36, w: 12, d: 9, h: 20, color: 0xc98d70, accent: 0x8a5a42, face: "+z" },
];

/** 中层公寓：填街区纵深，楼高 12~16m，带阳台，和塔楼拉开层次 */
export const MIDRISES: TowerDef[] = [
  { id: "mid-nw", x: 70, z: 70, w: 7, d: 7, h: 15, color: 0xd8c6ab, accent: 0x7d6a58, face: "-z" },
  { id: "mid-ne", x: 93, z: 70, w: 6, d: 7, h: 14, color: 0xc9c2b4, accent: 0x6e7a78, face: "-x" },
  { id: "mid-sw", x: 52, z: 30, w: 9, d: 8, h: 12, color: 0xd3bda6, accent: 0x8a6752, face: "+z" },
];

export const SHOPS: ShopDef[] = [
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
];

export const POCKET_PARK = { x: 115.5, z: 70, radius: 4.2 } as const;

export const DEALERSHIP = {
  id: "dealership",
  name: "星野汽车",
  x: 70, z: 41, w: 12, d: 10, h: 9.2,
  color: 0xf0e4cf, accent: 0x3f5562, glass: 0xbfe0e6,
} as const;

/** 街区块铺装（整块铺地，避免楼间露出草地） */
export const PLAZAS: Array<{ x0: number; x1: number; z0: number; z1: number }> = [
  { x0: 44.5, x1: 76.4, z0: 57.6, z1: 92 },
  { x0: 87.6, x1: 120, z0: 57.6, z1: 92 },
  { x0: 44.5, x1: 76.4, z0: 26, z1: 46.4 },
  { x0: 87.6, x1: 120, z0: 26, z1: 46.4 },
];

/** 街区外沿与城镇边界：树木/石头/草丛的排除区 */
export function inTown(x: number, z: number): boolean {
  if (x >= 44 && x <= 122 && z >= 22 && z <= 96) return true;
  // 大道与大道向西接桥的一小段
  if (x >= 42 && x <= 124 && z >= 47.4 && z <= 56.6) return true;
  return false;
}

/** 是否落在柏油路上（行人与装饰用） */
export function onRoad(x: number, z: number): boolean {
  const a = TOWN.avenue, c = TOWN.cross;
  if (x >= a.x0 && x <= a.x1 && Math.abs(z - a.z) <= a.half) return true;
  if (Math.abs(x - c.x) <= c.half && z >= c.z0 && z <= c.z1) return true;
  return false;
}

/** 人行道带：路口四角 2×2 的转角板也包含在内 */
function onSidewalk(x: number, z: number): boolean {
  const a = TOWN.avenue, c = TOWN.cross;
  if (x >= a.x0 && x <= a.x1 && (Math.abs(z - WALK.avenueSouthZ) <= 1 || Math.abs(z - WALK.avenueNorthZ) <= 1)) return true;
  if (z >= c.z0 && z <= c.z1 && (Math.abs(x - WALK.crossWestX) <= 1 || Math.abs(x - WALK.crossEastX) <= 1)) return true;
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

/** 行人节点图：四条人行道 + 路口四角；相邻节点之间过街即斑马线。 */
export function walkNodes(): { nodes: RouteNode[]; links: Array<[number, number]> } {
  const nodes: RouteNode[] = [];
  const links: Array<[number, number]> = [];
  const push = (x: number, z: number) => { nodes.push({ x, z }); return nodes.length - 1; };
  const connectLine = (xs: number[], z: number) => {
    const ids = xs.map(x => push(x, z));
    for (let i = 0; i < ids.length - 1; i++) links.push([ids[i], ids[i + 1]]);
    return ids;
  };
  const connectLineZ = (x: number, zs: number[]) => {
    const ids = zs.map(z => push(x, z));
    for (let i = 0; i < ids.length - 1; i++) links.push([ids[i], ids[i + 1]]);
    return ids;
  };

  const avenueSouth = connectLine([46, 53, 60, 67, 74, 77.4, 86.6, 94, 101, 108, 115, 120], WALK.avenueSouthZ);
  const avenueNorth = connectLine([46, 53, 60, 67, 74, 77.4, 86.6, 94, 101, 108, 115, 120], WALK.avenueNorthZ);
  const crossWest = connectLineZ(WALK.crossWestX, [28, 35, 42, 47.4, 56.6, 64, 72, 80, 88, 92]);
  const crossEast = connectLineZ(WALK.crossEastX, [28, 35, 42, 47.4, 56.6, 64, 72, 80, 88, 92]);

  // 路口四角互连：跨大道与跨十字街各两条，形成斑马线环
  const swS = avenueSouth[5], seS = avenueSouth[6];
  const nwS = avenueNorth[5], neS = avenueNorth[6];
  const swW = crossWest[3], nwW = crossWest[4];
  const seE = crossEast[3], neE = crossEast[4];
  links.push([swS, nwS], [seS, neS], [swW, seE], [nwW, neE]);

  return { nodes, links };
}
