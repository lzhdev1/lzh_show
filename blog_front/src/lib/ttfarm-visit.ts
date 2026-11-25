import { bagAddCheck } from "@farm-rules/backpack";
import { markCodexCollected, codexFishKey, codexMushroomKey, codexMutationKey, codexPlantKey } from "@farm-rules/codexCollection";
import { CROPS, MUTATION_SEED_DROP_CHANCE, forageYieldOf, harvestKey, harvestLots, harvestYieldOf, seedInfoOf, seedKey, type CropId } from "@farm-rules/crops";
import { fishById } from "@farm-rules/fish";
import { FORAGE_SEED_CHANCE, advanceForage, forageMutationSeedChance, forageRotationAt, wildPatchesAt } from "@farm-rules/forage";
import { applyGuestWater, guestWaterGate, isReady, plotIdAt, resetWater, settlePlotMutation, type PlotState } from "@farm-rules/growth";
import { baitById } from "@farm-rules/items";
import { MUSHROOMS, MUSHROOM_PICK_XP, mushroomYieldOf } from "@farm-rules/mushrooms";
import { baitCount, ranchCapacity, wildAnimalsAt, WILD_CLEARINGS } from "@farm-rules/ranch";
import { isRainy, weatherAt } from "@farm-rules/weather";
import type { Queryable } from "./ttfarm-auth";
import { FarmError } from "./ttfarm-http";
import { peersIn } from "./ttfarm-presence";
import { normalizeSave, type FarmSave } from "./ttfarm-save";

type Row = Record<string, any>;

/**
 * 协作接口读写的是房主的整份存档，必须把背包等级、图鉴、野菜与钓鱼字段都还原出来，
 * 否则一次帮忙收菜就会把房主的图鉴或鱼篓写回默认值。
 */
function saveFromRow(row: Row): FarmSave {
  const extras = row.shop_extras && typeof row.shop_extras === "object" ? row.shop_extras : {};
  return normalizeSave({
    coins: row.coins,
    xp: row.xp,
    plots: row.plots,
    seeds: row.seeds,
    harvest: row.harvest,
    decor: row.decor,
    ranch: row.ranch,
    forage: row.forage,
    backpackLevel: row.backpack_level,
    codexCollected: row.codex_collected,
    fishingRod: row.fishing_rod,
    fishCaught: row.fish_caught,
    items: extras.items,
    materials: extras.materials,
    ownedRods: extras.ownedRods,
    selectedBait: extras.selectedBait,
  }, row.nickname)!;
}

async function readFarm(client: Queryable, owner: number, lock: boolean) {
  const {rows} = await client.query(`SELECT u.nickname,s.*
    FROM farm_states s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1` + (lock ? " FOR UPDATE OF s" : ""),[owner]);
  const row = rows[0] as Row | undefined;
  if (!row) throw new FarmError(404,"没有找到这个农场");
  return {data: saveFromRow(row), revision: row.revision as number};
}

/** 房主可见库存：种子、收成、野菜记录与钓鱼资源都随协作授权一起下发。 */
function guestState(data: FarmSave, canHelp: boolean) {
  if (!canHelp) return { plots: data.plots, decor: data.decor, ranch: data.ranch, seeds: {}, harvest: {} };
  return {
    plots: data.plots,
    decor: data.decor,
    ranch: data.ranch,
    seeds: data.seeds,
    harvest: data.harvest,
    forage: advanceForage(data.forage, Date.now()),
    fishing: {
      rod: data.fishingRod,
      selectedBait: data.selectedBait,
      materials: data.materials,
      fishCaught: data.fishCaught,
      backpackLevel: data.backpackLevel,
    },
  };
}

export async function visitView(client: Queryable, self: number, owner: number, canHelp: boolean) {
  const {data,revision} = await readFarm(client,owner,false);
  return {owner:{id:String(owner),nickname:data.nickname},canHelp,revision,
    state:guestState(data,canHelp),
    peers:await peersIn(client,owner,self)};
}

/** 把房主存档里被协作改动的字段整体写回；没改的字段写回原值，绝不碰装饰与车库。 */
async function writeFarm(client: Queryable, owner: number, data: FarmSave) {
  await client.query(`UPDATE farm_states SET plots=$2,seeds=$3,harvest=$4,xp=$5,ranch=$6,coins=$7,forage=$8,
    backpack_level=$9,codex_collected=$10,fish_caught=$11,shop_extras=$12,
    save_version=GREATEST(save_version,8),revision=revision+1,updated_at=now() WHERE user_id=$1`,
    [owner,JSON.stringify(data.plots),JSON.stringify(data.seeds),JSON.stringify(data.harvest),data.xp,JSON.stringify(data.ranch),
      data.coins,JSON.stringify(data.forage),data.backpackLevel,JSON.stringify(data.codexCollected),JSON.stringify(data.fishCaught),
      JSON.stringify({items:data.items,materials:data.materials,ownedRods:data.ownedRods,selectedBait:data.selectedBait})]);
}

export async function helpFarm(client: Queryable, self: number, owner: number, body: Record<string,unknown>) {
  const {data,revision} = await readFarm(client,owner,true);
  if (body.revision !== revision) throw new FarmError(409,"地块或牧场已有更新，请重试");
  const presence = await client.query(`SELECT pose FROM farm_presence WHERE user_id=$1 AND owner_id=$2
    AND seen_at>now()-interval '12 seconds' FOR SHARE`,[self,owner]);
  if (!presence.rowCount) throw new FarmError(403,"请先进入好友农场");
  const position = presence.rows[0].pose as {x:number;z:number;mount:unknown;swimming:boolean;jumping:boolean};
  const now = Date.now();
  const action = String(body.action);

  if (action === "tame") {
    const animal = wildAnimalsAt(now).find(wild => wild.id === body.animalId);
    if (!animal || data.ranch.animals.some(owned => owned.id === animal.id)) throw new FarmError(409,"这只动物已离开或已收服");
    const [x,z] = WILD_CLEARINGS[animal.slot];
    if (Math.hypot(position.x-x,position.z-z)>15) throw new FarmError(400,"请靠近这只野生动物");
    if (data.ranch.animals.length>=ranchCapacity(data.ranch.level)) throw new FarmError(409,"好友的牧场已满");
    const bait = harvestLots(data.harvest).find(lot => lot.key === body.baitKey);
    if (!bait || bait.count<baitCount(animal,bait.crop.id)) throw new FarmError(409,"所选诱饵不足");
    data.harvest[bait.key] -= baitCount(animal,bait.crop.id);
    data.ranch.animals.push({id:animal.id,species:animal.species,element:animal.element});
  } else if (action === "forage") {
    if (position.mount || position.swimming || position.jumping) throw new FarmError(400,"请步行靠近野菜丛");
    // 草药是时间累积出来的，先把房主存档补到当前时刻，再确认这株还在
    data.forage = advanceForage(data.forage, now);
    // 野菜按轮次生成，草药是房主存档里的持久列表
    const patch = wildPatchesAt(now).find(item => item.id === body.patchId)
      ?? data.forage.herbs.find(item => item.id === body.patchId);
    if (!patch) throw new FarmError(409,"这丛已经不在了，再看看脚下");
    const rotation = forageRotationAt(now);
    if (data.forage.rotation !== rotation) data.forage = { ...data.forage, rotation, taken: [] };
    if (patch.source === "wild" && data.forage.taken.includes(patch.slot)) throw new FarmError(409,"这丛野菜已经被采走了");
    const def = CROPS[patch.crop];
    const key = harvestKey(def.id,patch.mutation);
    const count = forageYieldOf(def);
    // 普通种子 30% 独立判定；带变异的植株再额外按 20% 掉变异种子
    const seedDrop = Math.random() < FORAGE_SEED_CHANCE;
    const mutationSeedDrop = Math.random() < forageMutationSeedChance(patch);
    const normalSeedKey = def.id;
    const mutatedSeedKey = patch.mutation ? seedKey(def.id, patch.mutation) : null;
    const harvestRoom = bagAddCheck(data.harvest,key,count,data.backpackLevel);
    if (!harvestRoom.ok) throw new FarmError(409,`好友的杂物背包已满（${harvestRoom.used}/${harvestRoom.slots} 格）`);
    if (seedDrop && !bagAddCheck(data.seeds,normalSeedKey,1,data.backpackLevel).ok) {
      throw new FarmError(409,`好友的种子背包已满（${data.backpackLevel} 级）`);
    }
    if (mutationSeedDrop && mutatedSeedKey && !bagAddCheck(data.seeds,mutatedSeedKey,1,data.backpackLevel).ok) {
      throw new FarmError(409,`好友的种子背包已满（${data.backpackLevel} 级）`);
    }
    data.harvest[key] = Math.min(1_000_000,(data.harvest[key] ?? 0)+count);
    if (seedDrop) data.seeds[normalSeedKey] = (data.seeds[normalSeedKey] ?? 0)+1;
    if (mutationSeedDrop && mutatedSeedKey) data.seeds[mutatedSeedKey] = (data.seeds[mutatedSeedKey] ?? 0)+1;
    data.xp = Math.min(99_999_999,data.xp+def.xp);
    if (patch.source === "herb") data.forage.herbs = data.forage.herbs.filter(item => item.id !== patch.id);
    else data.forage.taken = [...data.forage.taken,patch.slot];
    data.codexCollected = markCodexCollected(data.codexCollected,[codexPlantKey(def.id),
      ...(patch.mutation ? [codexMutationKey(patch.mutation)] : [])]);
  } else if (action === "mushroom") {
    if (position.mount || position.swimming || position.jumping) throw new FarmError(400,"请步行靠近菌子");
    const species = MUSHROOMS[String(body.mushroomId)];
    if (!species) throw new FarmError(400,"没有这种菌子");
    const count = mushroomYieldOf();
    data.coins = Math.min(9_999_999_999,data.coins+species.price*count);
    data.xp = Math.min(99_999_999,data.xp+MUSHROOM_PICK_XP);
    data.codexCollected = markCodexCollected(data.codexCollected,[codexMushroomKey(species.id)]);
  } else if (action === "bait") {
    const baitId = body.baitId === null ? null : String(body.baitId);
    if (baitId !== null && !baitById(baitId)) throw new FarmError(400,"没有这种鱼饵");
    data.selectedBait = baitId;
  } else if (action === "consumeBait") {
    const baitId = String(body.baitId);
    if (!baitById(baitId)) throw new FarmError(400,"没有这种鱼饵");
    const have = data.materials[baitId] ?? 0;
    if (have <= 0) throw new FarmError(409,"好友的鱼饵已经用完了");
    data.materials[baitId] = have - 1;
    if (data.materials[baitId] <= 0) delete data.materials[baitId];
  } else if (action === "fish") {
    const fish = fishById(String(body.fishId));
    if (!fish) throw new FarmError(400,"没有这种鱼");
    const room = bagAddCheck(data.fishCaught,fish.id,1,data.backpackLevel);
    if (!room.ok) throw new FarmError(409,`好友的鱼篓已满（${room.used}/${room.slots} 格）`);
    data.fishCaught[fish.id] = Math.min(1_000_000,(data.fishCaught[fish.id] ?? 0)+1);
    data.codexCollected = markCodexCollected(data.codexCollected,[codexFishKey(fish.id)]);
  } else {
    if (!["plant","water","harvest"].includes(action)) throw new FarmError(400,"不支持此协作操作");
    if (!Number.isInteger(body.plotId)) throw new FarmError(400,"请选择菜地");
    const plot = data.plots[body.plotId as number] as PlotState | undefined;
    if (!plot?.unlocked) throw new FarmError(400,"地块尚未开垦");
    if (position.mount || position.swimming || position.jumping || plotIdAt(position.x,position.z)!==plot.id)
      throw new FarmError(400,"请步行站到这块菜地上");
    if (action === "plant") {
      const seed = String(body.crop);
      const info = seedInfoOf(seed);
      if (!info) throw new FarmError(400,"请选择种子");
      if (plot.crop || !data.seeds[seed]) throw new FarmError(409,"菜地已播种或没有种子");
      const weather = weatherAt(now);
      // 普通种子播种时不判定变异，从发芽阶段开始逐阶段判定；变异种子带着确定的变异下地
      const withSeed = {
        ...plot,
        crop: info.id,
        mutation: info.mutation,
        plantSeed: Math.floor(Math.random() * 0xffff_ffff),
        mutationChecked: info.mutation ? 3 : 0,
      };
      Object.assign(plot, resetWater(withSeed, now, isRainy(weather)));
      data.seeds[seed]--;
      if (data.seeds[seed] <= 0) delete data.seeds[seed];
    } else if (action === "water") {
      // 朋友每个小时窗口合计只能帮浇一次，被谁浇过就锁到下一个小时
      const gate = guestWaterGate(plot,now);
      if (!gate.ok) throw new FarmError(409, gate.reason === "quota"
        ? `这株刚被朋友浇过，${Math.ceil((gate.waitMs ?? 0)/60_000)} 分钟后再来`
        : "这块地目前无需浇水");
      Object.assign(plot, applyGuestWater(plot, now, String(self)));
    } else {
      if (!plot.crop || !isReady(plot,now)) throw new FarmError(409,"作物尚未成熟");
      // 成熟阶段也可能刚刚抽出变异，先结算再按最终状态收获
      Object.assign(plot, settlePlotMutation(plot, now));
      const crop = CROPS[plot.crop];
      const mutation = plot.mutation;
      const count = harvestYieldOf(crop, plot.id, plot.plantedAt);
      const key = harvestKey(crop.id,mutation);
      data.harvest[key] = Math.min(1_000_000,(data.harvest[key] ?? 0)+count);
      data.xp = Math.min(99_999_999,data.xp+crop.xp);
      if (mutation && Math.random() < MUTATION_SEED_DROP_CHANCE) {
        const seed = seedKey(crop.id, mutation);
        const room = bagAddCheck(data.seeds,seed,1,data.backpackLevel);
        if (room.ok) data.seeds[seed] = Math.min(1_000_000,(data.seeds[seed] ?? 0)+1);
      }
      Object.assign(plot,{crop:null,plantedAt:0,watered:0,mutation:null,plantSeed:0,mutationChecked:0,selfWater:[],selfWaterTotal:0,guestWater:null});
    }
  }
  await writeFarm(client,owner,data);
  return visitView(client,self,owner,true);
}
