import { create } from "zustand";
import { fishBallSpeed, fishById, fishSize, fishZoneWidth, rodById, rollFish } from "./fish";
import { baitById } from "./items";
import { useGame } from "./state";
import { helpAtFarm, useSocial } from "./social";

export type FishingPhase = "idle" | "casting" | "waiting" | "bite" | "reeling" | "result";
export type BiteKind = "sink" | "rise";

export interface CastSite {
  x: number;
  z: number;
  y: number;
  /** 水面到鱼漂的基准高度，场景里加入微浪 */
  waterY: number;
}

export interface FishingResult {
  ok: boolean;
  fishId: string | null;
  length: number;
  weight: number;
  /** 脱钩原因，成功时为空 */
  reason: string;
  at: number;
}

interface FishingStore {
  phase: FishingPhase;
  nearRiver: boolean;
  phaseAt: number;
  biteAt: number;
  biteStart: number;
  biteKind: BiteKind;
  fishId: string | null;
  reelAt: number;
  zoneStart: number;
  zoneWidth: number;
  ballSpeed: number;
  result: FishingResult | null;
  castSeed: number;
  /** 本次抛竿挂上的鱼饵；null 表示空钩，不会有鱼咬钩 */
  baitId: string | null;
  /** 当前上鱼/脱钩的展示标签 */
  banner: string;
  cast: () => boolean;
  lift: () => void;
  closeResult: () => void;
  cancel: (quiet?: boolean) => void;
}

let site: CastSite | null = null;
let near = false;
const lastNotify = { text: "", at: 0 };

function notifyOnce(text: string, tone: "ok" | "warn" = "warn") {
  const now = performance.now();
  if (lastNotify.text === text && now - lastNotify.at < 1200) return;
  lastNotify.text = text;
  lastNotify.at = now;
  useGame.getState().notify(text, tone, 2200);
}

/** 由主循环每帧写入最近的抛竿点；只有靠河与否变化时才通知 React。 */
export function updateCastSite(next: CastSite | null) {
  site = next;
  const ready = Boolean(next);
  if (ready !== near) {
    near = ready;
    useFishing.setState({ nearRiver: ready });
  }
}

export function currentCastSite(): CastSite | null {
  return site;
}

export function ballPosition(elapsed: number, speed: number): number {
  const raw = Math.max(0, elapsed) * speed;
  const phase = raw % 2;
  return phase <= 1 ? phase : 2 - phase;
}

/** 当前可用的协作现场；没有好友授权时返回 null。 */
function guestFarm() {
  const visit = useSocial.getState().visit;
  return visit?.mode === "friend" && visit.canManage ? visit : null;
}

/** 串门时优先用自己的鱼竿；自己没有装备才借房主已装备的那根。 */
export function effectiveRodId(): string | null {
  const own = useGame.getState().fishingRod;
  if (own) return own;
  return guestFarm()?.state.fishing?.rod ?? null;
}

/** 鱼饵库存与选中项：串门时用房主的，离开后回到自己的。 */
function baitSource() {
  const guest = guestFarm()?.state.fishing;
  if (guest) return guest;
  const own = useGame.getState();
  return { selectedBait: own.selectedBait, materials: own.materials };
}

function rodOf() {
  return rodById(effectiveRodId());
}

let guestBitePending = false;
let guestCatchPending = false;

export const useFishing = create<FishingStore>()((set, get) => ({
  phase: "idle",
  nearRiver: false,
  phaseAt: 0,
  biteAt: 0,
  biteStart: 0,
  biteKind: "sink",
  fishId: null,
  reelAt: 0,
  zoneStart: 0.25,
  zoneWidth: 0.18,
  ballSpeed: 0.5,
  result: null,
  castSeed: 0,
  baitId: null,
  banner: "",

  cast: () => {
    if (get().phase !== "idle" && get().phase !== "result") return false;
    const visit = useSocial.getState().visit;
    if (visit?.mode === "spectate" || (visit && !guestFarm())) {
      notifyOnce("还没有好友的协作授权，不能在这里下竿", "warn");
      return false;
    }
    const rod = rodOf();
    if (!rod) {
      notifyOnce("先去商店买鱼竿，再到背包「装备」页装上", "warn");
      return false;
    }
    if (!site) {
      notifyOnce("再靠近河岸一点，站在水边才好下竿", "warn");
      return false;
    }
    const now = performance.now();
    const source = baitSource();
    const chosen = baitById(source.selectedBait);
    const baitId = chosen && (source.materials[chosen.id] ?? 0) > 0 ? chosen.id : null;
    guestBitePending = false;
    guestCatchPending = false;
    set({
      phase: "casting", phaseAt: now, biteAt: 0, biteStart: 0, fishId: null, result: null,
      castSeed: Math.floor(Math.random() * 97), baitId,
      banner: baitId ? `抛竿 · ${chosen?.name ?? ""}${guestFarm() ? "（好友的鱼饵）" : ""}` : "抛竿 · 空钩",
    });
    if (!baitId && chosen) notifyOnce(`${chosen.name}用完了，空钩不会有鱼咬`, "warn");
    return true;
  },

  lift: () => {
    const s = get();
    const now = performance.now();
    if (s.phase === "casting") return;
    if (s.phase === "waiting") {
      get().cancel(true);
      notifyOnce("收了竿，等浮漂有动静再提", "ok");
      return;
    }
    if (s.phase === "bite") {
      if (now - s.biteStart > 5000) {
        set({ phase: "result", result: { ok: false, fishId: s.fishId, length: 0, weight: 0, reason: "提竿太慢，鱼吐钩游走了", at: now } });
        return;
      }
      const fish = fishById(s.fishId);
      const rod = rodOf();
      if (!fish) {
        set({ phase: "idle", fishId: null });
        return;
      }
      const width = fishZoneWidth(fish, rod?.zoneBonus ?? 0);
      set({
        phase: "reeling", reelAt: now,
        zoneStart: 0.13 + Math.random() * Math.max(0.05, 0.74 - width),
        zoneWidth: width,
        ballSpeed: fishBallSpeed(fish),
        banner: "稳住！等小球进亮区再起竿",
      });
      return;
    }
    if (s.phase === "reeling") {
      const x = ballPosition(now - s.reelAt, s.ballSpeed);
      const hit = x >= s.zoneStart && x <= s.zoneStart + s.zoneWidth;
      const fish = fishById(s.fishId);
      if (!fish) {
        set({ phase: "idle", fishId: null });
        return;
      }
      if (!hit) {
        set({ phase: "result", result: { ok: false, fishId: s.fishId, length: 0, weight: 0, reason: "起竿时机偏了，鱼线一松就脱钩", at: now } });
        return;
      }
      const size = fishSize(fish);
      const guest = guestFarm();
      if (guest) {
        if (guestCatchPending) return;
        guestCatchPending = true;
        // 先让 QTE 结束，再把鱼记到房主鱼篓；网络慢时若鱼篓满会改成脱钩结果。
        set({
          phase: "result",
          banner: "钓到了！",
          result: { ok: true, fishId: fish.id, length: size.length, weight: size.weight, reason: "", at: now },
        });
        void helpAtFarm({ action: "fish", fishId: fish.id }).then(() => {
          notifyOnce(`渔获已放进${guest.ownerName}的鱼篓`, "ok");
        }).catch((error) => {
          useFishing.setState({
            banner: "鱼篓满了",
            result: { ok: false, fishId: fish.id, length: 0, weight: 0,
              reason: error instanceof Error ? error.message : "好友的鱼篓装不下，这条鱼只能放回河里", at: now },
          });
        }).finally(() => { guestCatchPending = false; });
        return;
      }
      const added = useGame.getState().collectFish(fish.id);
      set({
        phase: "result",
        banner: added ? "钓到了！" : "鱼篓满了",
        result: {
          ok: added, fishId: fish.id, length: size.length, weight: size.weight,
          reason: added ? "" : "鱼篓装不下，这条鱼只能放回河里", at: now,
        },
      });
    }
  },

  closeResult: () => {
    if (get().phase !== "result") return;
    set({ phase: "idle", fishId: null, result: null, banner: "", baitId: null });
  },

  cancel: (quiet = false) => {
    const s = get();
    if (s.phase === "idle") return;
    set({ phase: "idle", fishId: null, result: null, banner: "", biteAt: 0, biteStart: 0, reelAt: 0, baitId: null });
    if (!quiet) notifyOnce("已收竿", "ok");
  },
}));

/** 主循环驱动的状态机。只负责时间窗和阶段推进，真正的 QTE 命中由玩家点击判定。
 * 5 秒咬钩窗口是需求里写死的；30 秒拉鱼上限同样写死。
 */
export function tickFishing(now: number) {
  const s = useFishing.getState();
  if (s.phase === "casting" && now - s.phaseAt >= 900) {
    useFishing.setState({ phase: "waiting", phaseAt: now, biteAt: now + 2600 + Math.random() * 3400 });
    return;
  }
  if (s.phase === "waiting" && now >= s.biteAt) {
    const bait = baitById(s.baitId);
    const guest = guestFarm();
    if (!bait) {
      useFishing.setState({
        phase: "result",
        result: {
          ok: false, fishId: null, length: 0, weight: 0,
          reason: "钩上一直没有鱼饵，鱼连看都没看一眼", at: now,
        },
        banner: "空钩",
      });
      return;
    }
    if (guest) {
      if (guestBitePending) return;
      guestBitePending = true;
      const bittenAt = s.biteAt;
      void helpAtFarm({ action: "consumeBait", baitId: bait.id }).then(() => {
        const current = useFishing.getState();
        if (current.phase !== "waiting" || current.biteAt !== bittenAt) return;
        const fish = rollFish(Math.random, bait.weights);
        useFishing.setState({
          phase: "bite", phaseAt: performance.now(), biteStart: performance.now(), fishId: fish.id,
          biteKind: Math.random() < 0.52 ? "sink" : "rise",
          banner: `${fish.name}咬钩！5 秒内提竿`,
        });
      }).catch((error) => {
        const current = useFishing.getState();
        if (current.phase !== "waiting" || current.biteAt !== bittenAt) return;
        useFishing.setState({
          phase: "result",
          result: { ok: false, fishId: null, length: 0, weight: 0,
            reason: error instanceof Error ? error.message : "好友的鱼饵没能挂上钩", at: performance.now() },
          banner: "鱼饵不足",
        });
      }).finally(() => { guestBitePending = false; });
      return;
    }
    const game = useGame.getState();
    if ((game.materials[bait.id] ?? 0) <= 0) {
      useFishing.setState({
        phase: "result",
        result: {
          ok: false, fishId: null, length: 0, weight: 0,
          reason: "钩上一直没有鱼饵，鱼连看都没看一眼", at: now,
        },
        banner: "空钩",
      });
      return;
    }
    game.consumeBait(bait.id);
    const fish = rollFish(Math.random, bait.weights);
    useFishing.setState({
      phase: "bite", phaseAt: now, biteStart: now, fishId: fish.id,
      biteKind: Math.random() < 0.52 ? "sink" : "rise",
      banner: `${fish.name}咬钩！5 秒内提竿`,
    });
    return;
  }
  if (s.phase === "bite" && now - s.biteStart > 5000) {
    useFishing.setState({
      phase: "result",
      result: { ok: false, fishId: s.fishId, length: 0, weight: 0, reason: "5 秒内没有提竿，鱼脱钩了", at: now },
      banner: "脱钩",
    });
    return;
  }
  if (s.phase === "reeling" && now - s.reelAt > 30000) {
    useFishing.setState({
      phase: "result",
      result: { ok: false, fishId: s.fishId, length: 0, weight: 0, reason: "遛鱼超过 30 秒，线松了", at: now },
      banner: "脱钩",
    });
  }
}

/** 咬钩鱼种：靠稀有度加权，鱼竿等级只影响高亮区，不偷偷改概率。 */
export function describeFishingPhase(phase: FishingPhase): string {
  switch (phase) {
    case "casting": return "抛竿中";
    case "waiting": return "等鱼儿咬钩";
    case "bite": return "咬钩！快提竿";
    case "reeling": return "遛鱼中";
    case "result": return "等待收竿";
    default: return "可以下竿";
  }
}
