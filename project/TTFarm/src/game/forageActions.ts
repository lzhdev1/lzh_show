import { CROPS, harvestKey, produceName } from "./crops";
import { FORAGE_SEED_CHANCE, FORAGE_XP, HERB_FORAGE_XP, HERB_SEED_CHANCE, forageRotationAt, wildPatchesAt, type ForageState } from "./forage";
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
      const patch = wildPatchesAt(now).find((item) => item.id === id);
      if (!patch || useForageInteraction.getState().nearbyPatch?.id !== id) {
        return notify("走近菜丛才能采摘", "warn");
      }
      const taken = forage.rotation === rotation ? forage.taken : [];
      if (taken.includes(patch.slot)) return;
      const def = CROPS[patch.crop];
      const key = harvestKey(def.id, patch.mutation);
      const herb = Boolean(def.herb);
      const seedDrop = Math.random() < (herb ? HERB_SEED_CHANCE : FORAGE_SEED_CHANCE);
      const harvestRoom = bagAddCheck(harvest, key, 1, backpackLevel);
      if (!harvestRoom.ok) {
        return notify(`杂物背包已满（${harvestRoom.used}/${harvestRoom.slots} 格），先升级背包或卖掉一批`, "warn");
      }
      if (seedDrop) {
        const seedRoom = bagAddCheck(seeds, def.id, 1, backpackLevel);
        if (!seedRoom.ok) {
          return notify(`种子背包已满（${seedRoom.used}/${seedRoom.slots} 格），先升级背包`, "warn");
        }
      }
      set({
        xp: xp + (herb ? HERB_FORAGE_XP : FORAGE_XP),
        harvest: { ...harvest, [key]: (harvest[key] ?? 0) + 1 },
        seeds: seedDrop ? { ...seeds, [def.id]: (seeds[def.id] ?? 0) + 1 } : seeds,
        codexCollected: markCodexCollected(codexCollected, [
          codexPlantKey(def.id),
          ...(patch.mutation ? [codexMutationKey(patch.mutation)] : []),
        ]),
        forage: { rotation, taken: [...taken, patch.slot] },
      });
      setNearbyPatch(null);
      notify(`采到${produceName(def, patch.mutation)} ×1${seedDrop ? `，还捡到${def.name}种子 ×1` : ""}`);
    },
  };
}