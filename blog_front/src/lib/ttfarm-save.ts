import type { Pool } from "pg";

// 与前端 game/state.ts 保持一致的常量：格子是 6×5=30，开局最前面一排 6 块已开垦
export const PLOT_COLS = 6;
export const PLOT_ROWS = 5;
export const PLOT_COUNT = PLOT_COLS * PLOT_ROWS;
export const START_UNLOCKED = PLOT_COLS;
/** 测试期金币：新号直接给一大笔，方便试扩建 */
export const START_COINS = 99_999_999;
/** 每块地每天最多浇几次水，服务端也卡一遍 */
const MAX_WATER = 3;
const CROP_IDS = ["radish", "cabbage", "tomato", "corn", "strawberry", "pumpkin"];

export interface PlotState {
  id: number;
  unlocked: boolean;
  crop: string | null;
  plantedAt: number;
  watered: number;
}

export interface FarmSave {
  coins: number;
  xp: number;
  plots: PlotState[];
  seeds: Record<string, number>;
  harvest: Record<string, number>;
  nickname: string;
  avatarId: string;
  selectedSeed: string;
}

export interface UserRow {
  id: number;
  username: string;
  nickname: string;
  avatar_id: string;
}

export function initialSave(nickname = "农场主"): FarmSave {
  const plots: PlotState[] = Array.from({ length: PLOT_COUNT }, (_, id) => ({
    id,
    unlocked: id < START_UNLOCKED,
    crop: null,
    plantedAt: 0,
    watered: 0,
  }));
  const zero: Record<string, number> = {};
  CROP_IDS.forEach((crop) => {
    zero[crop] = 0;
  });
  return {
    coins: START_COINS,
    xp: 0,
    plots,
    seeds: { ...zero, radish: 3, cabbage: 2 },
    harvest: { ...zero },
    nickname,
    avatarId: "xiaosui",
    selectedSeed: "radish",
  };
}

const int = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const str = (value: unknown, maxLength: number, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || fallback;
};

function record(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...fallback };
  if (raw && typeof raw === "object") {
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
      if (!/^[a-z]{1,24}$/.test(key)) return;
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
export function normalizeSave(raw: unknown, fallbackNick: string): FarmSave | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Partial<FarmSave>;

  const rawPlots = Array.isArray(src.plots) ? src.plots : [];
  const plots: PlotState[] = [];
  for (let id = 0; id < PLOT_COUNT; id += 1) {
    const old = rawPlots.find((p) => p && Number(p.id) === id) as Partial<PlotState> | undefined;
    const crop = typeof old?.crop === "string" && /^[a-z]{1,24}$/.test(old.crop) ? old.crop : null;
    plots.push({
      id,
      unlocked: Boolean(old?.unlocked),
      crop,
      plantedAt: crop ? int(old?.plantedAt, 0, 9_999_999_999_999, 0) : 0,
      watered: crop ? int(old?.watered, 0, MAX_WATER, 0) : 0,
    });
  }

  const base = initialSave(fallbackNick);
  return {
    coins: int(src.coins, 0, 9_999_999_999, base.coins),
    xp: int(src.xp, 0, 99_999_999, 0),
    plots,
    seeds: record(src.seeds, base.seeds),
    harvest: record(src.harvest, base.harvest),
    nickname: str(src.nickname, 12, fallbackNick),
    avatarId: "xiaosui",
    selectedSeed: typeof src.selectedSeed === "string" && CROP_IDS.includes(src.selectedSeed)
      ? src.selectedSeed
      : "radish",
  };
}

/** 按用户名找账号，没有就建一个（前期「一个账号直接登录」就靠这一步兜底） */
export async function findOrCreateUser(pool: Pool, username: string): Promise<UserRow> {
  const found = await pool.query<UserRow>(
    "SELECT id, username, nickname, avatar_id FROM users WHERE username = $1",
    [username]
  );
  if (found.rows.length > 0) {
    await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [found.rows[0].id]);
    return found.rows[0];
  }

  const created = await pool.query<UserRow>(
    `INSERT INTO users (username, nickname, avatar_id, last_login_at)
     VALUES ($1, $1, 'xiaosui', now())
     RETURNING id, username, nickname, avatar_id`,
    [username]
  );
  const user = created.rows[0];

  const save = initialSave(user.username);
  await pool.query(
    `INSERT INTO farm_states (user_id, coins, xp, plots, seeds, harvest, selected_seed)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
     ON CONFLICT (user_id) DO NOTHING`,
    [
      user.id,
      save.coins,
      save.xp,
      JSON.stringify(save.plots),
      JSON.stringify(save.seeds),
      JSON.stringify(save.harvest),
      save.selectedSeed,
    ]
  );
  return user;
}

export async function loadSave(pool: Pool, userId: number, nickname: string): Promise<FarmSave> {
  const res = await pool.query<{
    coins: string;
    xp: number;
    plots: PlotState[];
    seeds: Record<string, number>;
    harvest: Record<string, number>;
    selected_seed: string;
  }>(
    `SELECT coins, xp, plots, seeds, harvest, selected_seed
       FROM farm_states WHERE user_id = $1`,
    [userId]
  );

  if (res.rows.length === 0) {
    // 账号在、存档丢了（比如手工清过表）：按初始档补一份，别让人卡在空白农场
    const fresh = initialSave(nickname);
    await saveState(pool, userId, fresh);
    return fresh;
  }

  const row = res.rows[0];
  return normalizeSave(
    {
      coins: Number(row.coins),
      xp: row.xp,
      plots: row.plots,
      seeds: row.seeds,
      harvest: row.harvest,
      selectedSeed: row.selected_seed,
      nickname,
      avatarId: "xiaosui",
    },
    nickname
  ) ?? initialSave(nickname);
}

export async function saveState(pool: Pool, userId: number, save: FarmSave): Promise<void> {
  await pool.query(
    `INSERT INTO farm_states (user_id, coins, xp, plots, seeds, harvest, selected_seed, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, now())
     ON CONFLICT (user_id) DO UPDATE SET
       coins = EXCLUDED.coins,
       xp = EXCLUDED.xp,
       plots = EXCLUDED.plots,
       seeds = EXCLUDED.seeds,
       harvest = EXCLUDED.harvest,
       selected_seed = EXCLUDED.selected_seed,
       updated_at = now()`,
    [
      userId,
      save.coins,
      save.xp,
      JSON.stringify(save.plots),
      JSON.stringify(save.seeds),
      JSON.stringify(save.harvest),
      save.selectedSeed,
    ]
  );
}
