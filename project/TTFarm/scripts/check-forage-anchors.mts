/**
 * 调试用：打印游戏实际使用的 26 个野菜锚点，核对分布与合理性。
 * 用法：npx tsx scripts/check-forage-anchors.mts
 */
import { FORAGE_ANCHORS } from "../src/scene/forageAnchors";
import { RIVER_BED, riverInfo, roadInfo } from "../src/scene/layout";
import { onRanchReserve } from "../src/scene/ranchLayout";

console.log(`锚点 ${FORAGE_ANCHORS.length} 个`);
let minNeighbour = Infinity;
for (let i = 0; i < FORAGE_ANCHORS.length; i++) {
  for (let j = i + 1; j < FORAGE_ANCHORS.length; j++) {
    minNeighbour = Math.min(minNeighbour, Math.hypot(
      FORAGE_ANCHORS[i][0] - FORAGE_ANCHORS[j][0], FORAGE_ANCHORS[i][1] - FORAGE_ANCHORS[j][1]));
  }
}
const quad = [0, 0, 0, 0];
const band = { near: 0, mid: 0, far: 0 };
let bad = 0;
for (const [x, z] of FORAGE_ANCHORS) {
  const d = Math.hypot(x, z);
  const river = riverInfo(x, z).dist;
  const road = roadInfo(x, z);
  quad[(x >= 0 ? 0 : 1) + (z >= 0 ? 0 : 2)]++;
  if (d < 35) band.near++; else if (d < 65) band.mid++; else band.far++;
  const flag = river < RIVER_BED.shoulder + 2.5 || road < 2.2 || onRanchReserve(x, z, 2);
  if (flag) bad++;
  console.log(`(${x.toFixed(1)}, ${z.toFixed(1)})  距原点 ${d.toFixed(0)}m  离河心 ${river.toFixed(1)}m  离路 ${road.toFixed(1)}m${flag ? "  !! 不合理" : ""}`);
}
console.log(`最近邻间距 ${minNeighbour.toFixed(1)} m`);
console.log(`象限分布 [+x+z, -x+z, +x-z, -x-z] = ${quad.join(" / ")}`);
console.log(`距离分带 近<35:${band.near} 中35-65:${band.mid} 远>65:${band.far}`);
console.log(bad ? `有 ${bad} 个锚点踩在河/路/牧场里` : "全部锚点落在合理草地");
