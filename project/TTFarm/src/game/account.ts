import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ttfarmApi, type AccountUser, type RemoteState } from "../api/client";
import { useGame } from "./state";
import { isMutation } from "./weather";
import { avatarIdOf, outfitIdOf } from "./appearance";
import { normalizeDecor } from "./decor";

interface AccountStore {
  token: string | null;
  user: AccountUser | null;
  pending: boolean;
  error: string;
  /** 登录（账号不存在会自动建号）/ 注册，成功返回 true */
  signIn: (username: string, mode: "login" | "register") => Promise<boolean>;
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
    mutation: plot.crop && isMutation(plot.mutation) ? plot.mutation : null,
  }));

  useGame.setState({
    coins: state.coins,
    xp: state.xp,
    plots,
    seeds: state.seeds,
    harvest: state.harvest,
    nickname: state.nickname,
    avatarId: avatarIdOf(state.avatarId),
    outfitId: outfitIdOf(state.outfitId),
    bottomId: outfitIdOf(state.bottomId, outfitIdOf(state.outfitId)),
    decor: normalizeDecor(state.decor),
    selectedSeed: state.selectedSeed,
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
    nickname: s.nickname,
    avatarId: s.avatarId,
    outfitId: s.outfitId,
    bottomId: s.bottomId,
    decor: s.decor,
    selectedSeed: s.selectedSeed,
  };
}

// 每个账号各自暂存最近一次改动。关闭页签时即使请求中断，下次登录也能续传。
const drafts = new Map<number, string>();
const uploads = new Map<number, Promise<void>>();
let saveTimer = 0;
let localRevision = 0;
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

function remember(owner: number, json: string): void {
  drafts.set(owner, json);
  try {
    window.localStorage.setItem(draftKey(owner), json);
  } catch {
    // 隐私模式或空间不足时，仍然可以直接上传内存里的快照。
  }
}

function upload(owner: number, token: string): Promise<void> {
  const running = uploads.get(owner);
  if (running) return running;
  const send = async () => {
    let json = readDraft(owner);
    while (json) {
      await ttfarmApi.saveState(token, JSON.parse(json));
      if (drafts.get(owner) === json) drafts.delete(owner);
      try {
        const key = draftKey(owner);
        if (window.localStorage.getItem(key) === json) window.localStorage.removeItem(key);
      } catch { /* 内存快照已提交 */ }
      json = readDraft(owner);
    }
  };
  const task = send().catch((error) => {
    console.warn("[TT农场] 本机已保留待同步的存档", error);
  }).finally(() => { uploads.delete(owner); });
  uploads.set(owner, task);
  return task;
}

export async function flushActive(): Promise<void> {
  window.clearTimeout(saveTimer);
  const { token, user } = useAccount.getState();
  if (token && user && readDraft(user.id)) await upload(user.id, token);
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
      state.nickname === prev.nickname &&
      state.avatarId === prev.avatarId &&
      state.outfitId === prev.outfitId &&
      state.bottomId === prev.bottomId &&
      state.decor === prev.decor &&
      state.selectedSeed === prev.selectedSeed
    )) return;
    const { user, token } = useAccount.getState();
    if (!token || !user) return;
    localRevision++;
    remember(user.id, JSON.stringify(pickSave()));
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

      signIn: async (username, mode) => {
        set({ pending: true, error: "" });
        try {
          const result =
            mode === "register"
              ? await ttfarmApi.register(username)
              : await ttfarmApi.login(username);
          const pending = readDraft(result.user.id);
          restore(pending ? JSON.parse(pending) : result.state);
          set({ token: result.token, user: result.user, pending: false, error: "" });
          if (pending) flushActive();
          useGame.getState().notify(`欢迎回来，${result.user.nickname}`);
          return true;
        } catch (error) {
          set({
            pending: false,
            error: error instanceof Error ? error.message : "登录失败",
          });
          return false;
        }
      },

      signOut: () => {
        flushActive();
        set({ token: null, user: null, error: "" });
      },

      refresh: async () => {
        const { token, user } = get();
        if (!token || !user) return;
        const revision = localRevision;
        try {
          const pending = readDraft(user.id);
          if (pending) {
            restore(JSON.parse(pending));
            await upload(user.id, token);
            return;
          }
          const { state } = await ttfarmApi.loadState(token);
          if (get().token === token && revision === localRevision) restore(state);
        } catch (error) {
          console.warn("[TT农场] 拉取存档失败，先用本地存档顶着", error);
        }
      },
    }),
    {
      name: "ttfarm-account",
      // 只记登录票据和账号信息，pending / error 是临时态
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
);
