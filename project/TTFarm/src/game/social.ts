import { create } from "zustand";
import { FarmApiError, requestFarm } from "../api/client";
import { useAccount } from "./account";
import { normalizeAppearance, type AvatarId, type OutfitId } from "./appearance";
import type { CropId } from "./crops";
import type { FarmDecor } from "./decor";
import type { PlotState } from "./growth";
import type { AnimalElement, AnimalSpecies, RanchState } from "./ranch";
import type { ActionId } from "../scene/rig";
import { useGame } from "./state";

export interface FriendUser {
  id: string;
  nickname: string;
  avatarId: string;
  status: "friend" | "incoming" | "outgoing" | "none";
  grant: boolean;
  canHelp: boolean;
}

export interface SocialPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
  running: boolean;
  swimming: boolean;
  jumping: boolean;
  mount?: { species: AnimalSpecies; element: AnimalElement | null } | null;
  action?: ActionId | null;
  actionTime?: number;
}

export interface SocialPlayer extends SocialPose {
  id: string;
  nickname: string;
  avatarId: AvatarId;
  outfitId: OutfitId;
  bottomId: OutfitId;
  lastSeen: number;
}

export type VisitMode = "friend" | "spectate";
export interface Visit {
  ownerId: string;
  ownerName: string;
  mode: VisitMode;
  canManage: boolean;
  revision: number;
  state: {
    plots: PlotState[];
    decor: FarmDecor;
    ranch: RanchState;
    seeds: Partial<Record<CropId, number>>;
    harvest: Record<string, number>;
  };
}

interface Snapshot {
  owner: { id: string; nickname: string };
  canHelp: boolean;
  revision: number;
  state: Visit["state"];
  peers: SocialPlayer[];
}

export const useSocial = create<{
  visit: Visit | null;
  players: SocialPlayer[];
  reconnecting: boolean;
  present: boolean;
  visitOnFoot: boolean;
}>(() => ({ visit: null, players: [], reconnecting: false, present: false, visitOnFoot:false }));

function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  return requestFarm<T>("/" + path, {
    ...init, cache: "no-store", headers: { Authorization: "Bearer " + token },
  });
}

export function listFriends(token: string, query: string, signal?: AbortSignal) {
  return request<{ users: FriendUser[] }>(token, query ? "friends?q=" + encodeURIComponent(query) : "friends", { signal });
}

export function changeFriend(token: string, target: Pick<FriendUser, "id" | "nickname">,
  action: "request" | "accept" | "decline" | "grant" | "remove", allow?: boolean) {
  return request(token, "friends", { method: "POST",
    body: JSON.stringify({ targetNickname: target.nickname, targetId: target.id, action, allow }) });
}

function visitPath(ownerId: string, mode: VisitMode) {
  return "visit?" + new URLSearchParams({ ownerId, mode });
}

function roster(peers: SocialPlayer[]) {
  const me = String(useAccount.getState().user?.id);
  return peers.filter(peer => String(peer.id) !== me).map(peer => ({
    ...peer, id: String(peer.id), ...normalizeAppearance(peer.avatarId, peer.outfitId, peer.bottomId),
  }));
}

function applySnapshot(snapshot: Snapshot, mode: VisitMode) {
  const current = useSocial.getState().visit;
  const ownerId = String(snapshot.owner.id);
  if (current?.ownerId === ownerId && current.mode === mode && current.revision > snapshot.revision) return;
  const canManage = mode === "friend" && snapshot.canHelp;
  useSocial.setState({
    visit: current?.ownerId === ownerId && current.mode === mode && current.revision === snapshot.revision &&
      current.canManage === canManage && current.ownerName === snapshot.owner.nickname
      ? current : { ownerId, ownerName: snapshot.owner.nickname, mode, canManage, revision: snapshot.revision, state: snapshot.state },
    players: roster(snapshot.peers), reconnecting: false,
  });
}

let visitGeneration = 0;
let snapshotVersion = 0;
let localPose: SocialPose | null = null;
let lastHeartbeat: Promise<unknown> | null = null;
let assistingIn: number | null = null;
export function setLocalPresence(pose: SocialPose) { localPose = pose; }

export async function enterVisit(ownerId: string, mode: VisitMode, signal: AbortSignal) {
  const token = useAccount.getState().token;
  if (!token) throw new Error("请先登录");
  const generation = ++visitGeneration;
  const snapshot = await request<Snapshot>(token, visitPath(ownerId, mode), { signal });
  if (token !== useAccount.getState().token || signal.aborted || generation !== visitGeneration) return;
  useGame.getState().selectPlot(null);
  localPose = null;
  useSocial.setState({ present: false, visitOnFoot: true });
  applySnapshot(snapshot, mode);
}

export function leaveVisit() {
  visitGeneration++;
  localPose = null;
  useSocial.setState({ visit: null, players: [], reconnecting: false, present: false, visitOnFoot:false });
}

type HelpAction =
  | { action: "plant"; plotId: number; crop: CropId }
  | { action: "water" | "harvest"; plotId: number }
  | { action: "tame"; animalId: string; baitKey: string };

export async function helpAtFarm(action: HelpAction) {
  const { token } = useAccount.getState();
  const { visit, reconnecting, present } = useSocial.getState();
  if (!token || !visit?.canManage || visit.mode !== "friend" || reconnecting || !present) throw new Error("当前无法协作，请稍后再试");
  const generation = visitGeneration;
  if (assistingIn === generation) throw new Error("正在完成上一次协作");
  const active = () => generation === visitGeneration && useAccount.getState().token === token;
  assistingIn = generation;
  try {
    // 先等旧位置写入，再报告脚下位置，避免两个请求在慢网络上乱序。
    if (lastHeartbeat) await lastHeartbeat.catch(() => {});
    if (!active()) return;
    if (!localPose) throw new Error("正在进入好友农场");
    await request(token, "presence", { method: "POST", body: JSON.stringify({ ownerId: visit.ownerId, mode: "friend", ...localPose }) });
    if (!active()) return;
    const result = await request<Snapshot>(token, "visit", {
      method: "POST", body: JSON.stringify({ ownerId: visit.ownerId, mode: visit.mode, revision: visit.revision, ...action }),
    });
    if (active()) { snapshotVersion++; applySnapshot(result, visit.mode); }
  } catch (error) {
    if (active() && error instanceof FarmApiError && (error.status === 403 || error.status === 409)) {
      // 权限撤回和版本冲突都需要读取最新现场，不能自动重放操作。
      const fresh = await request<Snapshot>(token, visitPath(visit.ownerId, visit.mode)).catch(() => null);
      if (active() && fresh) { snapshotVersion++; applySnapshot(fresh, visit.mode); }
    }
    throw error;
  } finally { if (assistingIn === generation) assistingIn = null; }
}

/** Each session has one in-flight heartbeat. Spectators only poll the public projection. */
export function startSocialSync(onHomeRevision: (revision: number) => void) {
  let stopRoom = () => {};
  let scope = "";
  const bind = () => {
    const { token, user, identityChecked } = useAccount.getState();
    const ready = identityChecked && Boolean(user?.nickname);
    const visit = useSocial.getState().visit;
    const ownerId = visit?.ownerId ?? String(user?.id);
    const mode = visit?.mode ?? "home";
    const key = JSON.stringify([token, ownerId, mode, ready]);
    if (key === scope) return;
    scope = key;
    stopRoom();
    stopRoom = () => {};
    if (!token || !user || !ready) return;
    const abort = new AbortController();
    let timer = 0;
    let lastContact = Date.now();
    const removePresence = () => {
      if (mode !== "spectate") void fetch("/api/ttfarm/presence?ownerId=" + encodeURIComponent(ownerId), {
        method: "DELETE", keepalive: true, headers: { Authorization: "Bearer " + token },
      }).catch(() => {});
    };
    const poll = async () => {
      let delay = mode === "spectate" ? 1600 : 650;
      const version = snapshotVersion;
      const live = () => !abort.signal.aborted && version === snapshotVersion;
      try {
        if (document.hidden) { delay = 1800; return; }
        if (mode === "spectate") {
          const snapshot = await request<Snapshot>(token, visitPath(ownerId, mode), { signal: abort.signal });
          if (live()) { applySnapshot(snapshot, mode); lastContact = Date.now(); }
        } else if (localPose && assistingIn !== visitGeneration) {
          const flight = request<Pick<Snapshot, "canHelp" | "revision" | "peers">>(token, "presence", {
            method: "POST", signal: abort.signal, body: JSON.stringify({ ownerId, mode, ...localPose }),
          });
          lastHeartbeat = flight;
          const result = await flight;
          if (!live()) return;
          lastContact = Date.now();
          useSocial.setState({ players: roster(result.peers), reconnecting: false, present: true });
          if (mode === "home") {
            if (!result.peers.length && !localPose?.moving) delay = 1800;
            onHomeRevision(result.revision);
          }
          else {
            const current = useSocial.getState().visit;
            if (current && (result.revision !== current.revision || result.canHelp !== current.canManage)) {
              if (!result.canHelp && current.canManage) useSocial.setState({ visit: { ...current, canManage: false, state: { ...current.state, seeds: {}, harvest: {} } } });
              const snapshot = await request<Snapshot>(token, visitPath(ownerId, mode), { signal: abort.signal });
              if (live()) applySnapshot(snapshot, mode);
            }
          }
        }
      } catch (error) {
        if (!live()) return;
        if (error instanceof FarmApiError && (error.status === 401 || error.code === "NICKNAME_REQUIRED")) {
          useSocial.setState({ reconnecting: true, present: false });
          await useAccount.getState().refresh();
          delay = 2200;
          return;
        }
        if (mode !== "home" && error instanceof FarmApiError && [403, 404].includes(error.status)) {
          leaveVisit();
          useGame.getState().notify(error.message, "warn");
          return;
        }
        const now = Date.now();
        useSocial.setState(state => ({ reconnecting: true, present: false, players: now - lastContact >= 12000
          ? [] : state.players.filter(peer => now - peer.lastSeen < 12000) }));
        delay = 2200;
      } finally {
        if (!abort.signal.aborted) timer = window.setTimeout(poll, delay);
      }
    };
    window.addEventListener("pagehide", removePresence);
    stopRoom = () => {
      abort.abort();
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", removePresence);
      removePresence();
    };
    void poll();
  };
  const offAccount = useAccount.subscribe((next, prev) => {
    if (next.token !== prev.token || next.user?.id !== prev.user?.id) leaveVisit();
    else if (next.identityChecked === prev.identityChecked && Boolean(next.user?.nickname) === Boolean(prev.user?.nickname)) return;
    else if (!next.identityChecked || !next.user?.nickname) leaveVisit();
    bind();
  });
  const offVisit = useSocial.subscribe((next, prev) => {
    if (next.visit?.ownerId !== prev.visit?.ownerId || next.visit?.mode !== prev.visit?.mode) bind();
  });
  bind();
  return () => { offAccount(); offVisit(); stopRoom(); };
}
