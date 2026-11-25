import { CROPS, forageYieldOf, harvestKey, produceName, seedKey } from "./crops";
import { forageMutationSeedChance, forageRotationAt, forageSeedChance, wildPatchesAt, type ForageState } from "./forage";
import { setNearbyPatch, useForageInteraction } from "./forageInteraction";
import { bagAddCheck } from "./backpack";
import { codexMutationKey, codexPlantKey, markCodexCollected, type CodexCollection } from "./codexCollection";

interface ForageData {
  forage: ForageState;
  harvest: Record<string, number>;
  seeds: Record<string, number>;
  xp: number;
  backpackLevel: number;
  codexCollected: CodexCollection;
}
interface ForageContext extends ForageData {
  notify: (text: string, tone?: "ok" | "warn") => void;
}
export interface ForageActions {
  foragePatch: (id: string) => void;
}

export function createForageActions(set: (value: Partial<ForageData>) => void, get: () => ForageContext): ForageActions {
  return {
    foragePatch(id) {
      const { forage, harvest, seeds, xp, backpackLevel, codexCollected, notify } = get();
      const now = Date.now();
      const rotation = forageRotationAt(now);
      // 野菜按轮次生成，草药是存档里的持久列表
      const patch = wildPatchesAt(now).find((item) => item.id === id) ?? forage.herbs.find((item) => item.id === id);
      if (!patch || useForageInteraction.getState().nearbyPatch?.id !== id) {
        return notify("走近菜丛才能采摘", "warn");
      }
      const taken = forage.rotation === rotation ? forage.taken : [];
      if (patch.source === "wild" && taken.includes(patch.slot)) {
        return notify("这丛野菜已经被采走了", "warn");
      }
      const def = CROPS[patch.crop];
      const key = harvestKey(def.id, patch.mutation);
      const count = forageYieldOf(def);
      // 普通种子 30% 单独判定；带变异的植株再额外按 20% 掉变异种子
      const seedDrop = Math.random() < forageSeedChance();
      const mutationSeedDrop = Math.random() < forageMutationSeedChance(patch);
      const normalSeedKey = def.id;
      const mutatedSeedKey = patch.mutation ? seedKey(def.id, patch.mutation) : null;
      const harvestRoom = bagAddCheck(harvest, key, count, backpackLevel);
      if (!harvestRoom.ok) {
        return notify(`杂物背包已满（${harvestRoom.used}/${harvestRoom.slots} 格），先升级背包或卖掉一批`, "warn");
      }
      if (seedDrop && !bagAddCheck(seeds, normalSeedKey, 1, backpackLevel).ok) {
        return notify(`种子背包已满（${backpackLevel} 级），先升级背包`, "warn");
      }
      if (mutationSeedDrop && mutatedSeedKey && !bagAddCheck(seeds, mutatedSeedKey, 1, backpackLevel).ok) {
        return notify(`种子背包已满（${backpackLevel} 级），先升级背包`, "warn");
      }
      const nextSeeds = { ...seeds };
      if (seedDrop) nextSeeds[normalSeedKey] = (nextSeeds[normalSeedKey] ?? 0) + 1;
      if (mutationSeedDrop && mutatedSeedKey) nextSeeds[mutatedSeedKey] = (nextSeeds[mutatedSeedKey] ?? 0) + 1;
      set({
        xp: xp + def.xp,
        harvest: { ...harvest, [key]: (harvest[key] ?? 0) + count },
        seeds: nextSeeds,
        codexCollected: markCodexCollected(codexCollected, [
          codexPlantKey(def.id),
          ...(patch.mutation ? [codexMutationKey(patch.mutation)] : []),
        ]),
        forage: patch.source === "herb"
          ? { ...forage, herbs: forage.herbs.filter((item) => item.id !== patch.id) }
          : { ...forage, rotation, taken: [...taken, patch.slot] },
      });
      setNearbyPatch(null);
      const drops = [
        seedDrop ? "普通种子 ×1" : "",
        mutationSeedDrop ? "变异种子 ×1" : "",
      ].filter(Boolean).join("、");
      notify(`采到${produceName(def, patch.mutation)} ×${count}${drops ? `，还捡到${drops}` : ""}`);
    },
  };
}
