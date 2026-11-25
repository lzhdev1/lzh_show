import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FarmApiError, ttfarmApi, type AccountUser, type RemoteState } from "../api/client";
import { mergeFarmSave } from "./saveMerge";
import { useGame } from "./state";
import { isMutation } from "./weather";
import { cropMutationValid, type CropId } from "./crops";
import { normalizeAppearance } from "./appearance";
import { normalizeDecor } from "./decor";
import { normalizeRanch } from "./ranch";
import { normalizeForage } from "./forage";
import { normalizeGarage } from "./garage";
import { normalizeBackpackLevel } from "./backpack";
import { normalizeFishingState } from "./fish";
import { migrateShopExtras } from "./items";
import { normalizeMeat } from "./market";
import {
  codexFromHoldings,
  mergeCodexCollections,
  normalizeCodexCollection,
} from "./codexCollection";

interface AccountStore {
  token: string | null;
  user: AccountUser | null;
  pending: boolean;
  error: string;
  identityChecked: boolean;
  lastVerifiedUserId: number | null;
  signIn: (username: string, nickname?: string) => Promise<"ok" | "missing" | "error">;
  setNickname: (nickname: string) => Promise<void>;
  signOut: () => void;
  /** 带着本地 token 去服务端拉一次最新存档（刷新页面时用） */
  refresh: () => Promise<void>;
}

/** 把服务端存档灌回游戏 store */
function applyRemoteState(state: RemoteState): void {
  const plots = state.plots.map((plot) => ({
    id: plot.id,
    unlocked: plot.unlocked,
    crop: plot.crop,
    plantedAt: plot.plantedAt,
    watered: plot.watered,
    mutation: plot.crop && isMutation(plot.mutation) && cropMutationValid(plot.crop as CropId, plot.mutation) ? plot.mutation : null,
    selfWater: Array.isArray(plot.selfWater) ? plot.selfWater.filter((t) => Number.isFinite(t)).slice(-5) : [],
    selfWaterTotal: Number.isFinite(plot.selfWaterTotal) ? Math.max(0, Math.trunc(plot.selfWaterTotal as number)) : 0,
    guestWater: plot.guestWater && typeof plot.guestWater.by === "string" && Number.isFinite(plot.guestWater.t)
      ? { by: plot.guestWater.by.slice(0, 64), t: plot.guestWater.t }
      : null,
    plantSeed: Number.isFinite(plot.plantSeed) ? Math.max(0, Math.trunc(plot.plantSeed as number)) >>> 0 : 0,
    mutationChecked: Number.isFinite(plot.mutationChecked) ? Math.max(0, Math.min(3, Math.trunc(plot.mutationChecked as number))) : 0,
  }));

  const ranch = normalizeRanch(state.ranch);
  const fishing = normalizeFishingState({ rod: state.fishingRod, fish: state.fishCaught });
  const extras = migrateShopExtras(
    {
      items: state.items,
      materials: state.materials,
      ownedRods: state.ownedRods,
      selectedBait: state.selectedBait,
    },
    fishing.rod,
  );

  useGame.setState({
    coins: state.coins,
    xp: state.xp,
    plots,
    seeds: state.seeds,
    harvest: state.harvest,
    meat: normalizeMeat(state.meat),
    nickname: useAccount.getState().user?.nickname ?? state.nickname,
    ...normalizeAppearance(state.avatarId, state.outfitId, state.bottomId),
    decor: normalizeDecor(state.decor),
    ranch,
    forage: normalizeForage(state.forage),
    garage: normalizeGarage(state.garage),
    backpackLevel: normalizeBackpackLevel(state.backpackLevel),
    fishingRod: fishing.rod,
    fishCaught: fishing.fish,
    items: extras.items,
    materials: extras.materials,
    ownedRods: extras.ownedRods,
    selectedBait: extras.selectedBait,
    codexCollected: mergeCodexCollections(
      normalizeCodexCollection(state.codexCollected),
      codexFromHoldings(state.seeds, state.harvest, ranch.animals.map((animal) => animal.species)),
    ),
    selectedSeed: state.selectedSeed,
    selectedBoost: null,
  });
}

/** 只取需要落库的字段，选中态、提示这些临时状态不存 */
function pickSave() {
  const s = useGame.getState();
  return {
    coins: s.coins,
    xp: s.xp,
    plots: s.plots,
    seeds: s.seeds,
    harvest: s.harvest,
    meat: s.meat,
    nickname: s.nickname,
    avatarId: s.avatarId,
    outfitId: s.outfitId,
    bottomId: s.bottomId,
    decor: s.decor,
    ranch: s.ranch,
    forage: s.forage,
    garage: s.garage,
    backpackLevel: s.backpackLevel,
    fishingRod: s.fishingRod,
    fishCaught: s.fishCaught,
    items: s.items,
    materials: s.materials,
    ownedRods: s.ownedRods,
    selectedBait: s.selectedBait,
    codexCollected: s.codexCollected,
    selectedSeed: s.selectedSeed,
  };
}

// 每个账号各自暂存最近一次改动。关闭页签时即使请求中断，下次登录也能续传。
const drafts = new Map<number, string>();
const flights = new Map<number, string>();
const uploads = new Map<number, Promise<void>>();
const baselines = new Map<number, RemoteState>();
type Draft = RemoteState & { base?: RemoteState; writeId?: string };
function writeKey(): string {
  const uuid = crypto.getRandomValues(new Uint8Array(16));
  uuid[6] = (uuid[6] & 15) | 64;
  uuid[8] = (uuid[8] & 63) | 128;
  const h = Array.from(uuid, b => b.toString(16).padStart(2,"0")).join("");
  return [h.slice(0,8), h.slice(8,12), h.slice(12,16), h.slice(16,20), h.slice(20)].join("-");
}
let saveTimer = 0;
let restoring = false;

function draftKey(owner: number): string {
  return `ttfarm-pending-${owner}`;
}

function readDraft(owner: number): string | null {
  const memory = drafts.get(owner);
  if (memory) return memory;
  try {
    return window.localStorage.getItem(draftKey(owner));
  } catch {
    return null;
  }
}

/** 草稿可能因断电、浏览器配额或旧客户端写坏；损坏时保留备份并回退服务端存档 */
function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    // 空对象或半截 JSON 也是合法 JSON；缺少核心字段的草稿不能覆盖账号。
    if (!Array.isArray(value.plots) || typeof value.coins !== "number" || !Number.isFinite(value.coins)) return null;
    return value as Draft;
  } catch {
    return null;
  }
}

function quarantineDraft(owner: number, raw: string | null) {
  if (!raw) return;
  try { window.localStorage.setItem(`${draftKey(owner)}-corrupt-${Date.now()}`, raw); } catch { /* storage unavailable */ }
  forget(owner, raw);
}

function remember(owner: number, json: string): void {
  drafts.set(owner, json);
  try {
    window.localStorage.setItem(draftKey(owner), json);
  } catch {
    // 隐私模式或空间不足时，仍然可以直接上传内存里的快照。
  }
}

// Keep the exact in-flight write across reloads. Later edits can already have
// replaced the draft when the server commits but its acknowledgement is lost.
function flight(owner: number, value?: string | null): string | null {
  const key = draftKey(owner) + "-sending";
  if (value === undefined) {
    try { return flights.get(owner) ?? localStorage.getItem(key); }
    catch { return flights.get(owner) ?? null; }
  }
  if (value === null) flights.delete(owner); else flights.set(owner, value);
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* memory fallback */ }
  return value;
}

function forget(owner: number, json: string) {
  const key = draftKey(owner);
  try {
    if (window.localStorage.getItem(key) === json) window.localStorage.removeItem(key);
  } catch { /* memory remains available */ }
  if (drafts.get(owner) === json) drafts.delete(owner);
}

function checkpoint(owner: number, json: string, remote: RemoteState) {
  const draft = parseDraft(json);
  if (!draft) {
    quarantineDraft(owner, json);
    return remote;
  }
  const { base, writeId, ...local } = draft;
  let resolved: RemoteState | null = local;
  if (local.ranch === undefined && (remote.saveVersion ?? 1) >= 2) resolved = null;
  else if ((local.revision ?? 0) !== (remote.revision ?? 0))
    resolved = base ? mergeFarmSave(base, local, remote) : null;
  if (!resolved) {
    try { localStorage.setItem(draftKey(owner) + "-conflict-backup", json); } catch { /* storage unavailable */ }
    forget(owner, json);
    if (useAccount.getState().user?.id === owner)
      useGame.getState().notify("另一位玩家已更改同一份进度，已载入最新农场，本机操作已备份", "warn");
    return remote;
  }
  const state = { ...resolved, nickname: remote.nickname, ranch: normalizeRanch(resolved.ranch),
    garage: normalizeGarage(resolved.garage), backpackLevel: normalizeBackpackLevel(resolved.backpackLevel),
    ...(() => { const fishing = normalizeFishingState({ rod: resolved.fishingRod, fish: resolved.fishCaught }); return { fishingRod: fishing.rod, fishCaught: fishing.fish }; })(),
    ...(() => { const extras = migrateShopExtras({ items: resolved.items, materials: resolved.materials, ownedRods: resolved.ownedRods, selectedBait: resolved.selectedBait }, resolved.fishingRod ?? null); return { items: extras.items, materials: extras.materials, ownedRods: extras.ownedRods, selectedBait: extras.selectedBait }; })(),
    codexCollected: normalizeCodexCollection(resolved.codexCollected),
    revision: remote.revision ?? 0 };
  remember(owner, JSON.stringify({ ...state, base: remote, writeId: (local.revision === remote.revision && writeId) || writeKey() }));
  return state;
}

function upload(owner: number, token: string): Promise<void> {
  const running = uploads.get(owner);
  if (running) return running;
  const send = async () => {
    let json = flight(owner) ?? readDraft(owner);
    while (json) {
      const draft = parseDraft(json);
      if (!draft) {
        quarantineDraft(owner, json);
        flight(owner, null);
        json = readDraft(owner);
        continue;
      }
      flight(owner,json);
      const {base: _base, writeId, ...sent} = draft;
      try {
        const { revision } = await ttfarmApi.saveState(token, sent, writeId);
        const remote = { ...sent, revision };
        baselines.set(owner, remote);
        const next = readDraft(owner);
        if (next === json) forget(owner, json);
        else if (next) {
          const newer = parseDraft(next);
          if (newer && (newer.revision ?? 0) < revision)
            remember(owner, JSON.stringify({ ...newer, revision, base: remote }));
          else if (!newer) quarantineDraft(owner, next);
        }
      } catch (error) {
        if (!(error instanceof FarmApiError && error.status === 409 && error.state)) throw error;
        baselines.set(owner, error.state);
        const resolved = checkpoint(owner, readDraft(owner) ?? json, error.state);
        if (useAccount.getState().user?.id === owner) restore(resolved);
      }
      flight(owner,null);
      json = readDraft(owner);
    }
  };
  const task = send().catch((error) => {
    if (error instanceof FarmApiError && error.status === 401 && useAccount.getState().token === token) {
      useAccount.setState({token:null, user:null, identityChecked:false, lastVerifiedUserId:null, error:"登录已过期，请重新登录农场"});
    }
    console.warn("[TT农场] 本机已保留待同步的存档", error);
  }).finally(() => { uploads.delete(owner); });
  uploads.set(owner, task);
  return task;
}

export async function flushActive(): Promise<void> {
  window.clearTimeout(saveTimer);
  const { token, user } = useAccount.getState();
  if (token && user?.nickname && useAccount.getState().identityChecked && (readDraft(user.id) || flight(user.id))) await upload(user.id, token);
}

function restore(state: RemoteState): void {
  restoring = true;
  try {
    applyRemoteState(state);
  } finally {
    restoring = false;
  }
}

export function startAutoSave(): () => void {
  const unsubscribe = useGame.subscribe((state, prev) => {
    if (restoring || (
      state.coins === prev.coins &&
      state.xp === prev.xp &&
      state.plots === prev.plots &&
      state.seeds === prev.seeds &&
      state.harvest === prev.harvest &&
      state.meat === prev.meat &&
      state.avatarId === prev.avatarId &&
      state.outfitId === prev.outfitId &&
      state.bottomId === prev.bottomId &&
      state.decor === prev.decor &&
      state.ranch === prev.ranch &&
      state.forage === prev.forage &&
      state.garage === prev.garage &&
      state.backpackLevel === prev.backpackLevel &&
      state.fishingRod === prev.fishingRod &&
      state.fishCaught === prev.fishCaught &&
      state.items === prev.items &&
      state.materials === prev.materials &&
      state.ownedRods === prev.ownedRods &&
      state.selectedBait === prev.selectedBait &&
      state.codexCollected === prev.codexCollected &&
      state.selectedSeed === prev.selectedSeed
    )) return;
    const { user, token } = useAccount.getState();
    if (!token || !user?.nickname || !useAccount.getState().identityChecked) return;
    const base = baselines.get(user.id);
    remember(user.id, JSON.stringify({ ...pickSave(), revision: base?.revision ?? 0, base, writeId: writeKey() }));
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flushActive, 1200);
  });
  const onHidden = () => { if (document.hidden) flushActive(); };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("pagehide", flushActive);
  window.addEventListener("online", flushActive);
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", flushActive);
    window.removeEventListener("online", flushActive);
    flushActive();
  };
}

export const useAccount = create<AccountStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      pending: false,
      error: "",
      identityChecked: false,
      lastVerifiedUserId: null,

      signIn: async (username, nickname) => {
        set({ pending: true, error: "" });
        try {
          const result = nickname === undefined ? await ttfarmApi.login(username) : await ttfarmApi.register(username,nickname);
          const pending = readDraft(result.user.id);
          baselines.set(result.user.id, result.state);
          const cached = parseDraft(pending);
          set({ token: result.token, user: result.user, identityChecked:true, lastVerifiedUserId:result.user.id, pending:false, error:"" });
          restore(cached?.writeId ? cached : pending ? checkpoint(result.user.id, pending, result.state) : result.state);
          if (result.user.nickname && (pending || flight(result.user.id))) void get().refresh();
          return "ok";
        } catch (error) {
          if (nickname === undefined && error instanceof FarmApiError && error.code === "ACCOUNT_NOT_FOUND") {
            set({ pending:false, error:"" });
            return "missing";
          }
          set({
            pending: false,
            error: error instanceof Error ? error.message : "登录失败",
          });
          return "error";
        }
      },

      setNickname: async (nickname) => {
        const { token, user } = get();
        if (!token || !user) throw new Error("请先登录");
        if (user.nickname) await flushActive();
        const result = await ttfarmApi.setNickname(token,nickname);
        if (get().token !== token) throw new Error("账号已切换，请重新进入");
        set({user:result.user, identityChecked:true, lastVerifiedUserId:user.id, error:""});
        // The account is authoritative for names, including when a local farm draft still needs replaying.
        useGame.setState({nickname:result.user.nickname});
        if (!readDraft(user.id) && !uploads.has(user.id)) { baselines.set(user.id,result.state); restore(result.state); }
        void get().refresh();
        useGame.getState().notify(user.nickname ? "昵称已更新" : `欢迎来到农场，${result.user.nickname}`);
      },
      signOut: () => {
        flushActive();
        set({ token:null, user:null, error:"", pending:false, identityChecked:false, lastVerifiedUserId:null });
      },

      refresh: async () => {
        const { token, user } = get();
        if (!token || !user) return;
        try {
          if (!get().identityChecked) set({pending:true,error:""});
          let { state, user:profile } = await ttfarmApi.loadState(token);
          if (get().token !== token) return;
          const known = baselines.get(user.id);
          if (known && (known.revision ?? 0) > (state.revision ?? 0)) return;
          set({user:profile, identityChecked:true, lastVerifiedUserId:profile.id, pending:false,error:""});
          useGame.setState({nickname:profile.nickname});
          if (!profile.nickname) { baselines.set(user.id,state); return; }
          const queued = readDraft(user.id);
          if (flight(user.id) || parseDraft(queued)?.writeId) {
            await upload(user.id, token);
            if (get().token !== token) return;
            ({ state } = await ttfarmApi.loadState(token));
            if (get().token !== token) return;
          }
          if (uploads.has(user.id) || flight(user.id) || (baselines.get(user.id)?.revision ?? -1) > (state.revision ?? 0)) return;
          const pending = readDraft(user.id);
          baselines.set(user.id, state);
          restore(pending ? checkpoint(user.id, pending, state) : state);
          if (pending) await upload(user.id, token);
        } catch (error) {
          if (error instanceof FarmApiError && error.status === 401 && get().token === token)
            set({token:null, user:null, pending:false, lastVerifiedUserId:null, identityChecked:false, error:"请重新登录农场"});
          else if (get().token === token && !get().identityChecked)
            set({pending:false, identityChecked:get().lastVerifiedUserId === user.id && !!user.nickname,
              error:"暂时连不上农场，请检查连接后重试"});
          console.warn("[TT农场] 拉取存档失败，先用本地存档顶着", error);
        }
      },
    }),
    {
      name: "ttfarm-account",
      // 只记登录票据和账号信息，pending / error 是临时态
      partialize: (s) => ({ token:s.token, user:s.user, lastVerifiedUserId:s.lastVerifiedUserId }),
    }
  )
);

let homeRefresh: Promise<void> | null = null;
export function observeHomeRevision(revision: number) {
  const account = useAccount.getState(), owner = account.user?.id;
  if (!owner || !baselines.has(owner) || revision <= (baselines.get(owner)?.revision ?? 0) || homeRefresh || uploads.has(owner)) return;
  homeRefresh = account.refresh().finally(() => { homeRefresh = null; });
}
