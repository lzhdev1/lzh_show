// 账号与存档接口：都挂在主站的 /api/ttfarm 下。
// 开发时由 Vite 的 proxy 透传给同容器的 Next，线上和页面同域，因此不需要拼域名、也没有跨域问题。

import type { CropId } from "../game/crops";
import type { FarmDecor } from "../game/decor";
import type { RanchState } from "../game/ranch";
import type { ForageState } from "../game/forage";
import type { GarageState } from "../game/garage";
import type { CodexCollection } from "../game/codexCollection";

const BASE = "/api/ttfarm";

export interface AccountUser {
  id: number;
  username: string;
  nickname: string;
  avatarId: string;
}

export interface CoinLeaderboardEntry {
  userId: string;
  rank: number;
  nickname: string;
  coins: number;
  isMe: boolean;
}

export interface RemotePlot {
  id: number;
  unlocked: boolean;
  crop: CropId | null;
  plantedAt: number;
  watered: number;
  mutation?: string | null;
  /** 自己浇水时间戳（最近 5 次），按小时配额判定用 */
  selfWater?: number[];
  /** 自己累计浇水次数，判断播种后 3 次免费额度 */
  selfWaterTotal?: number;
  /** 最近一次朋友帮浇，60 分钟内其他朋友不能再浇 */
  guestWater?: { by: string; t: number } | null;
  /** 本茬的变异随机种子与已判定阶段 */
  plantSeed?: number;
  mutationChecked?: number;
}

export interface RemoteState {
  revision?: number;
  saveVersion?: number;
  coins: number;
  xp: number;
  plots: RemotePlot[];
  seeds: Record<string, number>;
  harvest: Record<string, number>;
  /** 肉品库存，键为「物种」或「物种:元素」 */
  meat?: Record<string, number>;
  nickname: string;
  avatarId: string;
  selectedSeed: string;
  outfitId?: string;
  bottomId?: string;
  decor?: FarmDecor;
  ranch?: RanchState;
  forage?: ForageState;
  garage?: GarageState;
  backpackLevel?: number;
  codexCollected?: CodexCollection;
  fishingRod?: string | null;
  fishCaught?: Record<string, number>;
  items?: Record<string, number>;
  materials?: Record<string, number>;
  ownedRods?: string[];
  selectedBait?: string | null;
}

export interface AuthResult {
  token: string;
  user: AccountUser;
  state: RemoteState;
  needsNickname: boolean;
}
export class FarmApiError extends Error {
  constructor(message: string, readonly status: number, readonly state?: RemoteState, readonly code?: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `请求失败（${res.status}）`;
    const data = payload as { state?: RemoteState; code?: string } | null;
    throw new FarmApiError(message, res.status, data?.state, data?.code);
  }
  return payload as T;
}

export { request as requestFarm };

export const ttfarmApi = {
  leaderboard: (token: string, signal?: AbortSignal) =>
    request<{ entries: CoinLeaderboardEntry[] }>("/leaderboard", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal,
    }),

  login: (username: string) =>
    request<AuthResult>("/login", { method: "POST", body: JSON.stringify({ username }) }),

  register: (username: string, nickname: string) =>
    request<AuthResult>("/register", { method: "POST", body: JSON.stringify({ username, nickname }) }),

  setNickname: (token: string, nickname: string) =>
    request<{user:AccountUser; state:RemoteState}>("/nickname", {method:"PUT",
      headers:{Authorization:`Bearer ${token}`}, body:JSON.stringify({ nickname })}),

  loadState: (token: string) =>
    request<{ state: RemoteState; user:AccountUser; needsNickname:boolean }>("/state", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),

  saveState: (token: string, state: unknown, writeId?:string) =>
    request<{ ok: boolean; revision: number }>("/state", {
      method: "PUT",
      keepalive: true,
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state, writeId }),
    }),
};
