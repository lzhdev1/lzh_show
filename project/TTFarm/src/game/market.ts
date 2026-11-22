import { ANIMALS, ANIMAL_ELEMENTS, animalValue, type AnimalElement, type AnimalSpecies } from "./ranch";

/** 一头牲畜出肉份数 */
export const MEAT_YIELD = 4;

export interface MeatLot {
  key: string;
  name: string;
  price: number;
  count: number;
  species: AnimalSpecies;
  element: AnimalElement | null;
}

/** 肉品用「物种:元素」做键，保留变异溢价，不会把金猪和普通猪混在一起 */
export function meatKey(species: AnimalSpecies, element: AnimalElement | null): string {
  return element ? `${species}:${element}` : species;
}

export function parseMeatKey(key: string): { species: AnimalSpecies; element: AnimalElement | null } | null {
  const [species, element] = key.split(":");
  if (!(species in ANIMALS)) return null;
  const validElement = element && element in ANIMAL_ELEMENTS ? element as AnimalElement : null;
  return { species: species as AnimalSpecies, element: validElement };
}

export function meatName(species: AnimalSpecies, element: AnimalElement | null): string {
  return `${element ? ANIMAL_ELEMENTS[element].name + "·" : ""}${ANIMALS[species].name}肉`;
}

/** 单份肉价：整畜价值 / 出肉份数，再加 25% 柜台溢价 */
export function meatPrice(species: AnimalSpecies, element: AnimalElement | null): number {
  const value = animalValue({ id: "meat", species, element });
  return Math.max(1, Math.round((value / MEAT_YIELD) * 1.25));
}

export function meatLots(meat: Record<string, number>): MeatLot[] {
  return Object.entries(meat)
    .map(([key, count]) => {
      const parsed = parseMeatKey(key);
      if (!parsed || count <= 0) return null;
      return {
        key,
        name: meatName(parsed.species, parsed.element),
        price: meatPrice(parsed.species, parsed.element),
        count,
        species: parsed.species,
        element: parsed.element,
      } satisfies MeatLot;
    })
    .filter((lot): lot is MeatLot => lot !== null)
    .sort((a, b) => b.price * b.count - a.price * a.count);
}

export function normalizeMeat(value?: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = parseMeatKey(key);
    const count = Number(raw);
    if (!parsed || !Number.isFinite(count) || count <= 0) continue;
    out[key] = Math.min(9999, Math.trunc(count));
  }
  return out;
}
