export type CarModelId = "city" | "tourer" | "sport";

export interface CarModel {
  id: CarModelId;
  name: string;
  tagline: string;
  price: number;
  speed: number;
  handling: number;
  scale: number;
}

export const CAR_MODELS: CarModel[] = [
  { id: "city", name: "城光", tagline: "紧凑轿车，起步轻快，适合城里买菜", price: 1200, speed: 13, handling: 1.0, scale: 0.94 },
  { id: "tourer", name: "远山", tagline: "旅行车，车身长，能装下一整箱收成", price: 2200, speed: 15, handling: 0.9, scale: 1.06 },
  { id: "sport", name: "赤陶", tagline: "低趴跑车，油门到底时声音很好听", price: 3600, speed: 18, handling: 1.12, scale: 0.9 },
];

export const CAR_PAINTS = [
  { name: "陶土红", hex: 0xd96a4f },
  { name: "湖水蓝", hex: 0x6fa3b4 },
  { name: "麦芽黄", hex: 0xe7d2a6 },
  { name: "苔原绿", hex: 0x8aa36d },
  { name: "云母白", hex: 0xf0ede4 },
  { name: "石墨灰", hex: 0x59626c },
] as const;

export interface OwnedCar {
  id: string;
  model: CarModelId;
  color: number;
  plate: string;
  purchasedAt: number;
}

export interface GarageState {
  cars: OwnedCar[];
  activeId: string | null;
}

export function carModelOf(id: CarModelId): CarModel {
  return CAR_MODELS.find((m) => m.id === id) ?? CAR_MODELS[0];
}

export function normalizeGarage(value?: unknown): GarageState {
  const src = (value && typeof value === "object" ? value : {}) as Partial<GarageState>;
  const seen = new Set<string>();
  const cars: OwnedCar[] = [];
  for (const raw of Array.isArray(src.cars) ? src.cars : []) {
    if (!raw || typeof raw.id !== "string" || seen.has(raw.id)) continue;
    if (!CAR_MODELS.some((m) => m.id === raw.model)) continue;
    seen.add(raw.id);
    cars.push({
      id: raw.id.slice(0, 48),
      model: raw.model,
      color: Number.isFinite(raw.color) ? raw.color : CAR_PAINTS[0].hex,
      plate: typeof raw.plate === "string" ? raw.plate.slice(0, 10) : "京A·T01",
      purchasedAt: Number.isFinite(raw.purchasedAt) ? raw.purchasedAt : Date.now(),
    });
  }
  const activeId = typeof src.activeId === "string" && cars.some((c) => c.id === src.activeId) ? src.activeId : null;
  return { cars: cars.slice(0, 6), activeId };
}

export function newPlate(index: number): string {
  const n = String(index + 1).padStart(2, "0");
  return `京A·T${n}`;
}
