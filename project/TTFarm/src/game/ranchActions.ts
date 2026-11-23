import { harvestLots } from "./crops";
import { animalName, animalValue, baitCount, isMountAnimal, MOUNT_UNLOCK_LEVEL, ranchCapacity, ranchUpgradeCost, wildAnimalsAt, type RanchState } from "./ranch";
import { MEAT_YIELD, meatKey, meatName } from "./market";
import { setNearbyAnimal, useRanchInteraction } from "./ranchInteraction";

interface RanchData { ranch: RanchState; harvest: Record<string, number>; coins: number; meat: Record<string, number> }
interface RanchContext extends RanchData { notify: (text: string, tone?: "ok" | "warn") => void }
export interface RanchActions {
  upgradeRanch: () => void;
  tameWild: (id: string, baitKey: string) => void;
  setRiding: (id: string | null) => boolean;
  toggleMountPin: (id: string) => void;
  releaseAnimal: (id: string) => void;
  sellAnimal: (id: string) => void;
  /** 出栏：动物转为肉品库存，去河岸售货大厅卖 */
  butcherAnimal: (id: string) => void;
}

export function createRanchActions(set: (value: Partial<RanchData>) => void, get: () => RanchContext): RanchActions {
  return {
    upgradeRanch() {
      const { ranch, coins, notify } = get();
      const cost = ranchUpgradeCost(ranch.level);
      if (cost === null) return;
      if (coins < cost) return notify("牧场升级所需金币不足", "warn");
      const level = ranch.level + 1;
      set({ coins: coins - cost, ranch: { ...ranch, level } });
      notify(level === MOUNT_UNLOCK_LEVEL ? "牧场升至 3 级，坐骑栏已开启" : `牧场升至 ${level} 级，可容纳 ${ranchCapacity(level)} 只动物`);
    },
    tameWild(id, baitKey) {
      const { ranch, harvest, notify } = get();
      const animal = wildAnimalsAt(Date.now()).find((wild) => wild.id === id);
      if (!animal || useRanchInteraction.getState().nearbyAnimal?.id !== id) return notify("靠近野生动物才能投喂", "warn");
      if (ranch.animals.some((owned) => owned.id === id)) return;
      if (ranch.animals.length >= ranchCapacity(ranch.level)) return notify("牧场已满，请先扩建或放归动物", "warn");
      const bait = harvestLots(harvest).find((lot) => lot.key === baitKey);
      if (!bait) return notify("请先收获作物作为诱饵", "warn");
      const count = baitCount(animal, bait.crop.id);
      if (bait.count < count) return notify(`需要 ${count} 份${bait.name}`, "warn");
      const captured = { id, species: animal.species, element: animal.element };
      set({ harvest: { ...harvest, [bait.key]: harvest[bait.key] - count },
        ranch: { ...ranch, animals: [...ranch.animals, captured] } });
      setNearbyAnimal(null);
      notify(`${animalName(captured)}已入住${ranch.level >= MOUNT_UNLOCK_LEVEL && isMountAnimal(captured) ? "坐骑栏" : "牧场"}`);
    },
    setRiding(id) {
      const { ranch, notify } = get();
      if (id === ranch.ridingId) return true;
      if (id !== null) {
        const animal = ranch.animals.find((owned) => owned.id === id);
        if (ranch.level < MOUNT_UNLOCK_LEVEL || !animal || !isMountAnimal(animal)) {
          notify("牧场 3 级后，可在坐骑栏骑马或骑乘五行变异的坐骑", "warn");
          return false;
        }
        notify(`已骑上${animalName(animal)}`);
      }
      set({ ranch: { ...ranch, ridingId: id } });
      return true;
    },
    toggleMountPin(id) {
      const { ranch } = get();
      const animal = ranch.animals.find((owned) => owned.id === id);
      if (!animal || !isMountAnimal(animal)) return;
      const pinned = ranch.pinnedMounts ?? [];
      const next = pinned.includes(id) ? pinned.filter((mountId) => mountId !== id) : [id, ...pinned];
      set({ ranch: { ...ranch, pinnedMounts: next } });
    },
    releaseAnimal(id) {
      const { ranch, notify } = get();
      const animal = ranch.animals.find((owned) => owned.id === id);
      if (!animal) return;
      set({ ranch: { ...ranch, ridingId: ranch.ridingId === id ? null : ranch.ridingId,
        pinnedMounts: (ranch.pinnedMounts ?? []).filter((mountId) => mountId !== id),
        animals: ranch.animals.filter((owned) => owned.id !== id) } });
      notify(`已将${animalName(animal)}放归野外`);
    },
    sellAnimal(id) {
      const { ranch, coins, notify } = get();
      const animal = ranch.animals.find((owned) => owned.id === id);
      if (!animal) return;
      const value = animalValue(animal);
      set({ coins: coins + value, ranch: { ...ranch, ridingId: ranch.ridingId === id ? null : ranch.ridingId,
        pinnedMounts: (ranch.pinnedMounts ?? []).filter((mountId) => mountId !== id),
        animals: ranch.animals.filter((owned) => owned.id !== id) } });
      notify(`已卖出${animalName(animal)}，+${value} 金币`);
    },
    butcherAnimal(id) {
      const { ranch, meat, notify } = get();
      const animal = ranch.animals.find((owned) => owned.id === id);
      if (!animal) return;
      const key = meatKey(animal.species, animal.element);
      set({
        meat: { ...meat, [key]: (meat[key] ?? 0) + MEAT_YIELD },
        ranch: {
          ...ranch,
          ridingId: ranch.ridingId === id ? null : ranch.ridingId,
          pinnedMounts: (ranch.pinnedMounts ?? []).filter((mountId) => mountId !== id),
          animals: ranch.animals.filter((owned) => owned.id !== id),
        },
      });
      notify(`${animalName(animal)}已出栏，${meatName(animal.species, animal.element)} ×${MEAT_YIELD}`);
    },
  };
}
