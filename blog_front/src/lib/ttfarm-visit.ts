import { CROPS, harvestKey, harvestLots, type CropId } from "@farm-rules/crops";
import { isReady, MAX_WATER, plotIdAt, type PlotState } from "@farm-rules/growth";
import { baitCount, ranchCapacity, wildAnimalsAt, WILD_CLEARINGS } from "@farm-rules/ranch";
import { isRainy, rollMutation, weatherAt } from "@farm-rules/weather";
import type { Queryable } from "./ttfarm-auth";
import { FarmError } from "./ttfarm-http";
import { peersIn } from "./ttfarm-presence";
import { normalizeSave } from "./ttfarm-save";

async function readFarm(client: Queryable, owner: number, lock: boolean) {
  const {rows} = await client.query(`SELECT u.nickname,s.plots,s.seeds,s.harvest,s.xp,s.decor,s.ranch,s.revision
    FROM farm_states s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1` + (lock ? " FOR UPDATE OF s" : ""),[owner]);
  const row = rows[0];
  if (!row) throw new FarmError(404,"没有找到这个农场");
  return {data: normalizeSave(row,row.nickname)!, revision: row.revision as number};
}

export async function visitView(client: Queryable, self: number, owner: number, canHelp: boolean) {
  const {data,revision} = await readFarm(client,owner,false);
  return {owner:{id:String(owner),nickname:data.nickname},canHelp,revision,
    state:{plots:data.plots,decor:data.decor,ranch:data.ranch,seeds:canHelp ? data.seeds : {},harvest:canHelp ? data.harvest : {}},
    peers:await peersIn(client,owner,self)};
}

export async function helpFarm(client: Queryable, self: number, owner: number, body: Record<string,unknown>) {
  const {data,revision} = await readFarm(client,owner,true);
  if (body.revision !== revision) throw new FarmError(409,"地块或牧场已有更新，请重试");
  const presence = await client.query(`SELECT pose FROM farm_presence WHERE user_id=$1 AND owner_id=$2
    AND seen_at>now()-interval '12 seconds' FOR SHARE`,[self,owner]);
  if (!presence.rowCount) throw new FarmError(403,"请先进入好友农场");
  const position = presence.rows[0].pose as {x:number;z:number;mount:unknown;swimming:boolean;jumping:boolean};
  const now = Date.now();
  if (body.action === "tame") {
    const animal = wildAnimalsAt(now).find(wild => wild.id === body.animalId);
    if (!animal || data.ranch.animals.some(owned => owned.id === animal.id)) throw new FarmError(409,"这只动物已离开或已收服");
    const [x,z] = WILD_CLEARINGS[animal.slot];
    if (Math.hypot(position.x-x,position.z-z)>15) throw new FarmError(400,"请靠近这只野生动物");
    if (data.ranch.animals.length>=ranchCapacity(data.ranch.level)) throw new FarmError(409,"好友的牧场已满");
    const bait = harvestLots(data.harvest).find(lot => lot.key === body.baitKey);
    if (!bait || bait.count<baitCount(animal,bait.crop.id)) throw new FarmError(409,"所选诱饵不足");
    data.harvest[bait.key] -= baitCount(animal,bait.crop.id);
    data.ranch.animals.push({id:animal.id,species:animal.species,element:animal.element});
  } else {
    if (!["plant","water","harvest"].includes(String(body.action))) throw new FarmError(400,"不支持此协作操作");
    if (!Number.isInteger(body.plotId)) throw new FarmError(400,"请选择菜地");
    const plot = data.plots[body.plotId as number] as PlotState | undefined;
    if (!plot?.unlocked) throw new FarmError(400,"地块尚未开垦");
    if (position.mount || position.swimming || position.jumping || plotIdAt(position.x,position.z)!==plot.id)
      throw new FarmError(400,"请步行站到这块菜地上");
    if (body.action === "plant") {
      const crop = body.crop as CropId;
      if (typeof crop !== "string" || !Object.hasOwn(CROPS,crop)) throw new FarmError(400,"请选择种子");
      if (plot.crop || !data.seeds[crop]) throw new FarmError(409,"菜地已播种或没有种子");
      const weather = weatherAt(now);
      Object.assign(plot,{crop,plantedAt:now,watered:isRainy(weather) ? 1 : 0,mutation:rollMutation(weather)});
      data.seeds[crop]--;
    } else if (body.action === "water") {
      if (!plot.crop || isReady(plot,now) || plot.watered>=MAX_WATER) throw new FarmError(409,"这块地目前无需浇水");
      plot.watered++;
    } else {
      if (!plot.crop || !isReady(plot,now)) throw new FarmError(409,"作物尚未成熟");
      const crop = CROPS[plot.crop];
      const key = harvestKey(crop.id,plot.mutation);
      data.harvest[key] = Math.min(1_000_000,(data.harvest[key] ?? 0)+crop.yields);
      data.xp = Math.min(99_999_999,data.xp+crop.xp);
      Object.assign(plot,{crop:null,plantedAt:0,watered:0,mutation:null});
    }
  }
  await client.query(`UPDATE farm_states SET plots=$2,seeds=$3,harvest=$4,xp=$5,ranch=$6,
    save_version=GREATEST(save_version,3),revision=revision+1,updated_at=now() WHERE user_id=$1`,
    [owner,JSON.stringify(data.plots),data.seeds,data.harvest,data.xp,data.ranch]);
  return visitView(client,self,owner,true);
}
