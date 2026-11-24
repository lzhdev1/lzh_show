import type { Queryable } from "./ttfarm-auth";
import { CROPS, cropMutationValid } from "@farm-rules/crops";
import { MAX_WATER, PLOT_COUNT, START_UNLOCKED } from "@farm-rules/growth";
import { normalizeRanch as readRanch } from "@farm-rules/ranch";
import { normalizeForage as readForage } from "@farm-rules/forage";
import { normalizeGarage as readGarage } from "@farm-rules/garage";
import { normalizeBackpackLevel } from "@farm-rules/backpack";
import { normalizeFishingState } from "@farm-rules/fish";
import { migrateShopExtras, normalizeShopExtras, type ShopExtras } from "@farm-rules/items";
import { normalizeMeat } from "@farm-rules/market";
import {
  codexFromHoldings,
  mergeCodexCollections,
  normalizeCodexCollection,
  type CodexCollection,
} from "@farm-rules/codexCollection";
import { MUTATIONS as CROP_MUTATIONS, isMutation } from "@farm-rules/weather";

/** 测试期金币：新号直接给一大笔，方便试扩建 */
export const START_COINS = 99_999_999;
const CROP_IDS = Object.keys(CROPS);
const MUTATIONS = Object.keys(CROP_MUTATIONS);
const HARVEST_KEYS = CROP_IDS.flatMap((crop) => [crop, ...MUTATIONS.map((m) => `${crop}:${m}`)]);
const isBasicOutfit = (value: unknown): value is "field" | "raincoat" | "ranger" =>
  value === "field" || value === "raincoat" || value === "ranger";
// The farm client and the account service ship separately. Accept only the
// complete stage sets present in the client's game/couture catalogue.
const COUTURE_IDS = new Set([
  "petal-waltz", "rose-cadenza", "peach-fan", "lilac-ballet", "champagne-bell",
  "tide-jelly", "azure-sail", "pearl-opera", "mint-ripple", "glacier-lace",
  "lunar-arc", "violet-nocturne", "aurora-prism", "meteor-idol", "dusk-orbit",
]);

const decorStyle = (value: unknown) => value === "lantern" || value === "moon" ? value : "orchard";
function displayText(value: unknown, limit: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  // Unicode mode removes lone surrogates while preserving pairs such as emoji.
  const clean = value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\ud800-\udfff]/gu, "").trim();
  return Array.from(clean).slice(0, limit).join("") || fallback;
}
function readDecor(value: unknown) {
  const src = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { fence: decorStyle(src.fence), gate: decorStyle(src.gate), sign: decorStyle(src.sign),
    lettering: decorStyle(src.lettering), text: displayText(src.text, 12, "TT农场") };
}

export interface PlotState {
  id: number;
  unlocked: boolean;
  crop: string | null;
  plantedAt: number;
  watered: number;
  mutation: string | null;
}

export interface FarmSave {
  coins: number;
  xp: number;
  plots: PlotState[];
  seeds: Record<string, number>;
  harvest: Record<string, number>;
  meat: Record<string, number>;
  nickname: string;
  avatarId: string;
  outfitId: string;
  bottomId: string;
  decor: ReturnType<typeof readDecor>;
  ranch: ReturnType<typeof readRanch>;
  forage: ReturnType<typeof readForage>;
  garage: ReturnType<typeof readGarage>;
  backpackLevel: number;
  codexCollected: CodexCollection;
  fishingRod: string | null;
  fishCaught: Record<string, number>;
  items: Record<string, number>;
  materials: Record<string, number>;
  ownedRods: string[];
  selectedBait: string | null;
  selectedSeed: string;
}

export function initialSave(nickname = "农场主"): FarmSave {
  const plots: PlotState[] = Array.from({ length: PLOT_COUNT }, (_, id) => ({
    id,
    unlocked: id < START_UNLOCKED,
    crop: null,
    plantedAt: 0,
    watered: 0,
    mutation: null,
  }));
  const zero: Record<string, number> = {};
  CROP_IDS.forEach((crop) => {
    zero[crop] = 0;
  });
  const seeds = { ...zero, radish: 3, cabbage: 2 };
  return {
    coins: START_COINS,
    xp: 0,
    plots,
    seeds,
    harvest: { ...zero },
    meat: {},
    nickname,
    avatarId: "xiaosui",
    outfitId: "field",
    bottomId: "field",
    decor: readDecor(null),
    ranch: readRanch(null),
    forage: readForage(null),
    garage: readGarage(null),
    backpackLevel: 1,
    codexCollected: codexFromHoldings(seeds, {}, []),
    fishingRod: null,
    fishCaught: {},
    ...normalizeShopExtras({ materials: { worm: 3 }, selectedBait: "worm" }),
    selectedSeed: "radish",
  };
}

const int = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

function record(raw: unknown, fallback: Record<string, number>, keys: string[]): Record<string, number> {
  const out: Record<string, number> = { ...fallback };
  if (raw && typeof raw === "object") {
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
      if (!keys.includes(key)) return;
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = Math.min(1_000_000, Math.max(0, Math.round(n)));
    });
  }
  return out;
}

/**
 * 客户端送上来的存档一律在这里重新拼一遍：
 * 数值范围、字段白名单、地块数量都由服务端说了算，避免脏数据或超大 JSON 直接入库
 */
export function normalizeSave(raw: unknown, nickname: string): FarmSave | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Partial<FarmSave>;

  const rawPlots = Array.isArray(src.plots) ? src.plots : [];
  const plots: PlotState[] = [];
  for (let id = 0; id < PLOT_COUNT; id += 1) {
    const old = rawPlots.find((p) => p && Number(p.id) === id) as Partial<PlotState> | undefined;
    const crop = typeof old?.crop === "string" && CROP_IDS.includes(old.crop) ? old.crop : null;
    const mutation = crop && typeof old?.mutation === "string" && MUTATIONS.includes(old.mutation)
      && isMutation(old.mutation) && cropMutationValid(crop as keyof typeof CROPS, old.mutation)
      ? old.mutation : null;
    plots.push({
      id,
      unlocked: Boolean(old?.unlocked),
      crop,
      plantedAt: crop ? int(old?.plantedAt, 0, 9_999_999_999_999, 0) : 0,
      watered: crop ? int(old?.watered, 0, MAX_WATER, 0) : 0,
      mutation,
    });
  }

  const base = initialSave(nickname);
  const avatarId = src.avatarId === "qinghe" ? "qinghe" : "xiaosui";
  const selected = src.outfitId;
  const stageSet = avatarId === "xiaosui" && typeof selected === "string" && COUTURE_IDS.has(selected);
  const outfitId = stageSet || isBasicOutfit(selected) ? selected : base.outfitId;
  const seeds = record(src.seeds, base.seeds, CROP_IDS);
  const harvest = record(src.harvest, base.harvest, HARVEST_KEYS);
  const meat = normalizeMeat(src.meat);
  const ranch = readRanch(src.ranch);
  const fishing = normalizeFishingState({ rod: src.fishingRod, fish: src.fishCaught });
  const extras = migrateShopExtras(
    { items: src.items, materials: src.materials, ownedRods: src.ownedRods, selectedBait: src.selectedBait },
    fishing.rod,
  );
  const codexCollected = mergeCodexCollections(
    normalizeCodexCollection(src.codexCollected),
    codexFromHoldings(seeds, harvest, ranch.animals.map((animal) => animal.species)),
  );
  return {
    coins: int(src.coins, 0, 9_999_999_999, base.coins),
    xp: int(src.xp, 0, 99_999_999, 0),
    plots,
    seeds,
    harvest,
    meat,
    nickname,
    avatarId,
    outfitId,
    bottomId: stageSet || !isBasicOutfit(src.bottomId) ? outfitId : src.bottomId,
    decor: readDecor(src.decor),
    ranch,
    forage: readForage(src.forage),
    garage: readGarage(src.garage),
    backpackLevel: normalizeBackpackLevel(src.backpackLevel),
    codexCollected,
    fishingRod: fishing.rod,
    fishCaught: fishing.fish,
    items: extras.items,
    materials: extras.materials,
    ownedRods: extras.ownedRods,
    selectedBait: extras.selectedBait,
    selectedSeed: typeof src.selectedSeed === "string" && CROP_IDS.includes(src.selectedSeed)
      ? src.selectedSeed
      : "radish",
  };
}

export async function loadSave(pool: Queryable, userId: number, nickname: string): Promise<FarmSave & { saveVersion: number; revision: number }> {
  const res = await pool.query<{
    coins: string;
    xp: number;
    plots: PlotState[];
    seeds: Record<string, number>;
    harvest: Record<string, number>;
    meat: Record<string, number>;
    selected_seed: string;
    nickname: string;
    avatar_id: string;
    outfit_id: string;
    bottom_id: string | null;
    decor: FarmSave["decor"];
    ranch: FarmSave["ranch"];
    forage: FarmSave["forage"];
    garage: FarmSave["garage"];
    backpack_level: number;
    codex_collected: CodexCollection;
    fishing_rod: string | null;
    fish_caught: Record<string, number>;
    shop_extras: ShopExtras;
    save_version: number;
    revision: number;
  }>(
    `SELECT s.coins, s.xp, s.plots, s.seeds, s.harvest, s.meat, s.selected_seed, s.outfit_id, s.bottom_id, s.decor, s.ranch, s.forage, s.garage, s.backpack_level, s.codex_collected, s.fishing_rod, s.fish_caught, s.shop_extras, s.save_version, s.revision,
            CASE WHEN u.nickname_key IS NULL THEN '' ELSE u.nickname END AS nickname, u.avatar_id
       FROM farm_states s JOIN users u ON u.id = s.user_id WHERE s.user_id = $1`,
    [userId]
  );

  if (res.rows.length === 0) {
    // 账号在、存档丢了（比如手工清过表）：按初始档补一份，别让人卡在空白农场
    const fresh = initialSave(nickname);
    await pool.query(`INSERT INTO farm_states(user_id,coins,xp,plots,seeds,harvest,selected_seed)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO NOTHING`,
      [userId, fresh.coins, fresh.xp, JSON.stringify(fresh.plots), fresh.seeds, fresh.harvest, fresh.selectedSeed]);
    return loadSave(pool, userId, nickname);
  }

  const row = res.rows[0];
  const state = normalizeSave(
    {
      coins: Number(row.coins),
      xp: row.xp,
      plots: row.plots,
      seeds: row.seeds,
      harvest: row.harvest,
      meat: row.meat,
      selectedSeed: row.selected_seed,
      nickname: row.nickname,
      avatarId: row.avatar_id,
      outfitId: row.outfit_id,
      bottomId: row.bottom_id,
      decor: row.decor,
      ranch: row.ranch,
      forage: row.forage,
      garage: row.garage,
      backpackLevel: row.backpack_level,
      codexCollected: row.codex_collected,
      fishingRod: row.fishing_rod,
      fishCaught: row.fish_caught,
      items: row.shop_extras?.items,
      materials: row.shop_extras?.materials,
      ownedRods: row.shop_extras?.ownedRods,
      selectedBait: row.shop_extras?.selectedBait,
    },
    row.nickname
  ) ?? initialSave(nickname);
  return { ...state, saveVersion: row.save_version, revision: row.revision };
}

export async function saveState(pool: Queryable, userId: number, save: FarmSave,
                                includeWardrobe = true, includeDecor = true, includeBottom = true, includeRanch = true, includeForage = true, includeGarage = true, includeBackpack = true, expectedRevision: number | null = null, includeCodex = true, includeFishing = true, includeShop = true, includeMeat = true): Promise<number | null> {
  const result = await pool.query(
    `WITH written AS (
     INSERT INTO farm_states (user_id, coins, xp, plots, seeds, harvest, meat, selected_seed, outfit_id, decor, bottom_id, ranch, forage, garage, backpack_level, codex_collected, fishing_rod, fish_caught, shop_extras, save_version, revision, updated_at)
     SELECT id, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $31::jsonb, $7, $9, $10::jsonb, $13, $15::jsonb, $18::jsonb, $20::jsonb, $22, $24::jsonb, $26, $27::jsonb, $29::jsonb,
            CASE WHEN $32 THEN 9 WHEN $30 THEN 8 WHEN $28 THEN 7 WHEN $25 THEN 6 WHEN $23 THEN 5 WHEN $21 THEN 4 WHEN $17::integer IS NOT NULL THEN 3 WHEN $16 THEN 2 ELSE 1 END, 0, now() FROM users WHERE id = $1
     ON CONFLICT (user_id) DO UPDATE SET
       coins = EXCLUDED.coins,
       xp = EXCLUDED.xp,
       plots = EXCLUDED.plots,
       seeds = EXCLUDED.seeds,
       harvest = EXCLUDED.harvest,
       meat = CASE WHEN $32 THEN EXCLUDED.meat ELSE farm_states.meat END,
       selected_seed = EXCLUDED.selected_seed,
       outfit_id = CASE WHEN $11 THEN EXCLUDED.outfit_id ELSE farm_states.outfit_id END,
       bottom_id = CASE
         WHEN NOT $11 THEN farm_states.bottom_id
         WHEN $14 THEN EXCLUDED.bottom_id
         WHEN farm_states.outfit_id IS DISTINCT FROM EXCLUDED.outfit_id THEN NULL
         ELSE farm_states.bottom_id
       END,
       decor = CASE WHEN $12 THEN EXCLUDED.decor ELSE farm_states.decor END,
       ranch = CASE WHEN $16 THEN EXCLUDED.ranch ELSE farm_states.ranch END,
       forage = CASE WHEN $19 THEN EXCLUDED.forage ELSE farm_states.forage END,
       garage = CASE WHEN $21 THEN EXCLUDED.garage ELSE farm_states.garage END,
       backpack_level = CASE WHEN $23 THEN EXCLUDED.backpack_level ELSE farm_states.backpack_level END,
       codex_collected = CASE WHEN $25 THEN EXCLUDED.codex_collected ELSE farm_states.codex_collected END,
       fishing_rod = CASE WHEN $28 THEN EXCLUDED.fishing_rod ELSE farm_states.fishing_rod END,
       fish_caught = CASE WHEN $28 THEN EXCLUDED.fish_caught ELSE farm_states.fish_caught END,
       shop_extras = CASE WHEN $30 THEN EXCLUDED.shop_extras ELSE farm_states.shop_extras END,
       save_version = GREATEST(farm_states.save_version, EXCLUDED.save_version),
       revision = farm_states.revision + 1, updated_at = now()
     WHERE ($16 OR $21 OR $23 OR $25 OR $28 OR $30 OR $32 OR farm_states.save_version < 2)
       AND (farm_states.revision = $17 OR ($17 IS NULL AND farm_states.save_version < 3))
     RETURNING user_id,revision)
     UPDATE users SET avatar_id = CASE WHEN $11 THEN $8 ELSE avatar_id END
     FROM written WHERE users.id = written.user_id RETURNING written.revision`,
    [
      userId,
      save.coins,
      save.xp,
      JSON.stringify(save.plots),
      JSON.stringify(save.seeds),
      JSON.stringify(save.harvest),
      save.selectedSeed,
      save.avatarId,
      save.outfitId,
      JSON.stringify(save.decor),
      includeWardrobe,
      includeDecor,
      save.bottomId === save.outfitId ? null : save.bottomId,
      includeBottom,
      JSON.stringify(save.ranch),
      includeRanch,
      expectedRevision,
      JSON.stringify(save.forage),
      includeForage,
      JSON.stringify(save.garage),
      includeGarage,
      save.backpackLevel,
      includeBackpack,
      JSON.stringify(save.codexCollected),
      includeCodex,
      save.fishingRod,
      JSON.stringify(save.fishCaught),
      includeFishing,
      JSON.stringify({
        items: save.items,
        materials: save.materials,
        ownedRods: save.ownedRods,
        selectedBait: save.selectedBait,
      }),
      includeShop,
      JSON.stringify(save.meat),
      includeMeat,
    ]
  );
  return result.rows[0]?.revision ?? null;
}
