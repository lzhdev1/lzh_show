import type { CropId } from "./crops";

export const ANIMALS = {
  wolf:     { name: "灰狼", favorite: "tomato" },
  bear:     { name: "棕熊", favorite: "strawberry" },
  tiger:    { name: "老虎", favorite: "pumpkin" },
  lion:     { name: "狮子", favorite: "corn" },
  elephant: { name: "大象", favorite: "radish" },
  panda:    { name: "熊猫", favorite: "cabbage" },
  fox:      { name: "赤狐", favorite: "strawberry" },
  rabbit:   { name: "野兔", favorite: "radish" },
  deer:     { name: "梅花鹿", favorite: "cabbage" },
  boar:     { name: "野猪", favorite: "pumpkin" },
  goat:     { name: "山羊", favorite: "cabbage" },
  alpaca:   { name: "羊驼", favorite: "radish" },
  sheep:    { name: "绵羊", favorite: "cabbage" },
  horse:    { name: "野马", favorite: "radish" },
  cow:      { name: "花牛", favorite: "corn" },
  raccoon:  { name: "浣熊", favorite: "tomato" },
  redPanda: { name: "小熊猫", favorite: "strawberry" },
  penguin:  { name: "企鹅", favorite: "corn" },
  duck:     { name: "绿头鸭", favorite: "corn" },
  crane:    { name: "丹顶鹤", favorite: "tomato" },
} as const satisfies Record<string, { name: string; favorite: CropId }>;

export type AnimalSpecies = keyof typeof ANIMALS;
export const ANIMAL_ELEMENTS = {
  metal: { label: "金", name: "鎏金", color: "#ffcf66" },
  wood:  { label: "木", name: "灵木", color: "#9add8f" },
  water: { label: "水", name: "沧澜", color: "#8cdcea" },
  fire:  { label: "火", name: "绯焰", color: "#ff9c78" },
  earth: { label: "土", name: "星岩", color: "#dbab81" },
} as const;
export type AnimalElement = keyof typeof ANIMAL_ELEMENTS;
export interface RanchAnimal { id: string; species: AnimalSpecies; element: AnimalElement | null }
export interface WildAnimal extends RanchAnimal { slot: number }
export interface RanchState { level: number; animals: RanchAnimal[]; ridingId: string | null }

export const RANCH_MAX_LEVEL = 10;
export const WILD_CLEARINGS = [[2,20],[-1,25],[12,22],[-24,9],[-11,-21],[15,-23],[-33,34],
  [55,26],[-38,-31],[4,47],[1,-54],[-59,16]] as const;
export const MOUNT_UNLOCK_LEVEL = 3;
export const HORSE_SPEED_FACTOR = 3;
const upgradeCosts = [220, 460, 850, 1350, 2100, 3050, 4200, 5600, 7300];
export const ranchCapacity = (level: number) => 4 + (level - 1) * 2;
export const ranchUpgradeCost = (level: number): number | null => upgradeCosts[level - 1] ?? null;
const ELEMENTAL_MOUNTS: readonly AnimalSpecies[] = ["wolf", "bear", "tiger", "lion", "elephant", "panda"];
export const MOUNT_SPECIES: readonly AnimalSpecies[] = [...ELEMENTAL_MOUNTS, "horse"];
export const isMountAnimal = (animal: RanchAnimal) =>
  MOUNT_SPECIES.includes(animal.species) && (animal.species === "horse" || animal.element !== null);
export const animalName = (animal: RanchAnimal) =>
  (animal.element ? ANIMAL_ELEMENTS[animal.element].name + "·" : "") + ANIMALS[animal.species].name;
export const baitCount = (animal: RanchAnimal, crop: CropId) =>
  animal.element && crop !== ANIMALS[animal.species].favorite ? 2 : 1;

export function normalizeRanch(value?: unknown): RanchState {
  const src = (value && typeof value === "object" ? value : {}) as Partial<RanchState>;
  const level = Number.isFinite(src.level) ? Math.min(RANCH_MAX_LEVEL, Math.max(1, Math.trunc(src.level!))) : 1;
  const animals: RanchAnimal[] = [];
  const ids = new Set<string>();
  for (const animal of Array.isArray(src.animals) ? src.animals : []) {
    if (!animal || typeof animal.id !== "string" || !/^[\w-]{1,64}$/.test(animal.id)
      || ids.has(animal.id) || !SPECIES.includes(animal.species)) continue;
    ids.add(animal.id);
    animals.push({ id: animal.id, species: animal.species,
      element: animal.element && ELEMENTS.includes(animal.element) ? animal.element : null });
    if (animals.length === ranchCapacity(level)) break;
  }
  const riding = level >= MOUNT_UNLOCK_LEVEL && animals.find((animal) => animal.id === src.ridingId && isMountAnimal(animal));
  return { level, animals, ridingId: riding ? riding.id : null };
}

const SPECIES = Object.keys(ANIMALS) as AnimalSpecies[];
const ELEMENTS = Object.keys(ANIMAL_ELEMENTS) as AnimalElement[];
const WILD_ROTATION_MS = 12 * 60_000;
let lastRotation = -1;
let herd: WildAnimal[] = [];

/** 同一轮内重进游戏能看到同一批动物。每个出没点有独立身份，用于排除已收服的动物。 */
export function wildAnimalsAt(now: number): readonly WildAnimal[] {
  const rotation = Math.floor(now / WILD_ROTATION_MS);
  if (rotation === lastRotation) return herd;
  let seed = (rotation ^ 0xa651d842) >>> 0;
  const next = () => {
    seed = (seed + 0x9e3779b9) >>> 0;
    let value = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
  };
  const species = [...SPECIES];
  for (let i = species.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [species[i], species[j]] = [species[j], species[i]];
  }
  const ridingSpecies = species.findIndex((kind, i) => i > 0 && ELEMENTAL_MOUNTS.includes(kind));
  [species[1], species[ridingSpecies]] = [species[ridingSpecies], species[1]];
  herd = species.slice(0, 12).map((kind, slot) => {
    const mutated = slot === 1 || (slot !== 0 && next() < 0.34);
    return { id: `wild-${rotation}-${slot}`, slot, species: kind,
      element: mutated ? ELEMENTS[Math.floor(next() * ELEMENTS.length)] : null };
  });
  lastRotation = rotation;
  return herd;
}
