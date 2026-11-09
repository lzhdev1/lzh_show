import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ttfarmApi, type AccountUser, type RemoteState } from "../api/client";
import { useGame } from "./state";

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
    crop: (plot.crop ?? null) as never,
    plantedAt: plot.plantedAt,
    watered: plot.watered,
  }));

  useGame.setState({
    coins: state.coins,
    xp: state.xp,
    plots,
    seeds: state.seeds as never,
    harvest: state.harvest as never,
    nickname: state.nickname,
    avatarId: "xiaosui",
    selectedSeed: state.selectedSeed as never,
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
    selectedSeed: s.selectedSeed,
  };
}

// 每点一下都要写库太费，攒 1.2 秒一起写；内容没变就跳过
let saveTimer = 0;
let lastSaved = "";

function scheduleSave(): void {
  if (!useAccount.getState().token) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const token = useAccount.getState().token;
    if (!token) return;
    const snapshot = pickSave();
    const json = JSON.stringify(snapshot);
    if (json === lastSaved) return;
    ttfarmApi
      .saveState(token, snapshot)
      .then(() => {
        lastSaved = json;
      })
      .catch((error) => {
        console.warn("[TT农场] 存档写入失败", error);
      });
  }, 1200);
}

export function startAutoSave(): void {
  useGame.subscribe((state, prev) => {
    if (
      state.coins === prev.coins &&
      state.xp === prev.xp &&
      state.plots === prev.plots &&
      state.seeds === prev.seeds &&
      state.harvest === prev.harvest &&
      state.nickname === prev.nickname &&
      state.selectedSeed === prev.selectedSeed
    ) {
      return;
    }
    scheduleSave();
  });
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
          applyRemoteState(result.state);
          // 刚灌进来的这份就是服务端现状，别立刻又写回去
          lastSaved = JSON.stringify(pickSave());
          set({ token: result.token, user: result.user, pending: false, error: "" });
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
        set({ token: null, user: null, error: "" });
        lastSaved = "";
      },

      refresh: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const { state } = await ttfarmApi.loadState(token);
          applyRemoteState(state);
          lastSaved = JSON.stringify(pickSave());
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
