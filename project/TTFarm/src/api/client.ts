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
}

export interface RemoteState {
  revision?: number;
  saveVersion?: number;
  coins: number;
  xp: number;
  plots: RemotePlot[];
  seeds: Record<CropId, number>;
  harvest: Record<string, number>;
  nickname: string;
  avatarId: string;
  selectedSeed: CropId;
  outfitId?: string;
  bottomId?: string;
  decor?: FarmDecor;
  ranch?: RanchState;
  forage?: ForageState;
  garage?: GarageState;
  backpackLevel?: number;
  codexCollected?: CodexCollection;
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
