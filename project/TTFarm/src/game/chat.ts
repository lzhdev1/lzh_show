import { create } from "zustand";
import { FarmApiError, requestFarm } from "../api/client";
import { useAccount } from "./account";
import { useSocial } from "./social";
import { useGame } from "./state";

/** 头顶气泡持续 30 秒；房间历史最多保留 40 条供面板回看 */
export const BUBBLE_MS = 30_000;
export const CHAT_LIMIT = 80;
const KEEP = 40;
/** 只为最新消息保留到达时间与已读标记，避免长时间挂机无限增长 */
const META_LIMIT = KEEP * 4;
const POLL_MS = 1600;

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  body: string;
  /** 服务器时间，毫秒 */
  at: number;
}

export const useChat = create<{
  room: string | null;
  messages: ChatMessage[];
  unread: number;
  notice: string;
}>(() => ({ room: null, messages: [], unread: 0, notice: "" }));

// 记录每条消息第一次在本地出现的时刻，用于校正客户端与服务端的时钟偏差
const arrivals = new Map<string, number>();
// 已经处理过的消息；首次拉取到房间历史时只做基线，不补红点和顶部提示
const seen = new Map<string, true>();
let primedRoom: string | null = null;
/** 本次进入房间的基线时刻：早于它的消息一律不冒泡，避免登录后历史消息重新冒头 */
let bubbleFloor = 0;

function prune(records: Map<string, unknown>) {
  while (records.size > META_LIMIT) {
    const oldest = records.keys().next();
    if (oldest.done) break;
    records.delete(oldest.value);
  }
}

function markSeen(id: string) {
  seen.set(id, true);
  prune(seen);
}

function roomNow() {
  const { token, user } = useAccount.getState();
  if (!token || !user?.nickname) return null;
  const visit = useSocial.getState().visit;
  return { token, room: visit?.ownerId ?? String(user.id) };
}

function remember(message: ChatMessage, onlyNew = true) {
  if (arrivals.has(message.id)) return;
  // 冷启动拿到的历史消息不补气泡；进入房间后新到的消息按本地首次到达时间计时
  if (!onlyNew) return;
  arrivals.set(message.id, Date.now());
  prune(arrivals);
}

function merge(previous: ChatMessage[], incoming: ChatMessage[], rememberNew = true) {
  return mergeChatMessages(previous, incoming, rememberNew);
}

/** 合并本轮拉到的消息；只有本次新出现的消息才记录“到达时刻” */
export function mergeChatMessages(previous: ChatMessage[], incoming: ChatMessage[], rememberNew = true) {
  const map = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) {
    // 只有这次新出现的消息才算到达；否则每一轮轮询都会把房间历史重新计时，
    // 用户一上线就会看到旧消息气泡。
    if (!map.has(message.id)) remember(message, rememberNew);
    map.set(message.id, message);
  }
  return [...map.values()].sort((a, b) => a.at - b.at).slice(-KEEP);
}

export async function pullChat(signal?: AbortSignal) {
  const active = roomNow();
  if (!active) return;
  const result = await requestFarm<{ messages: ChatMessage[] }>(
    `/chat?${new URLSearchParams({ ownerId: active.room })}`,
    { signal, cache: "no-store", headers: { Authorization: "Bearer " + active.token } });
  const current = useChat.getState();
  if (current.room !== active.room) return;
  const primed = primedRoom === active.room;
  // 第一次成功拉取只建基线：这一批全部视为房间历史，即便它是在本次
  // startChatSync 之后才写进服务端的，也不在头顶冒泡。
  if (!primed) bubbleFloor = Date.now();
  const selfId = String(useAccount.getState().user?.id ?? "");
  let unread = current.unread;
  for (const message of result.messages) {
    if (seen.has(message.id)) continue;
    markSeen(message.id);
    // 首次进入房间拿到的是历史记录，只建基线；自己发的不算未读
    if (!primed || message.userId === selfId) continue;
    unread += 1;
    useGame.getState().notify(`${message.nickname}：${message.body}`, "chat", 9000);
  }
  primedRoom = active.room;
  useChat.setState({ messages: merge(current.messages, result.messages, primed), unread });
}

/** 打开发言面板即视为读完当前房间消息 */
export function markChatRead() {
  if (useChat.getState().unread) useChat.setState({ unread: 0 });
}

export async function sendChat(text: string) {
  const active = roomNow();
  if (!active) throw new Error("请先登录");
  const body = text.replace(/\s+/g, " ").trim();
  if (!body) throw new Error("说点什么吧");
  if (Array.from(body).length > CHAT_LIMIT) throw new Error(`一条消息最多 ${CHAT_LIMIT} 个字`);
  const result = await requestFarm<{ message: ChatMessage }>("/chat", {
    method: "POST", headers: { Authorization: "Bearer " + active.token },
    body: JSON.stringify({ ownerId: active.room, text: body }),
  });
  remember(result.message);
  markSeen(result.message.id);
  useChat.setState(state => ({ messages: merge(state.messages, [result.message]), notice: "" }));
  useGame.getState().notify(`${result.message.nickname}：${result.message.body}`, "chat", 9000);
  return result.message;
}

/** 某人当前应该显示的气泡；超过 30 秒返回 null */
export function bubbleText(userId: string, now = Date.now()): string | null {
  const { messages } = useChat.getState();
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.userId !== userId) continue;
    // 只认本次进入房间后本地首次到达的消息：历史消息没有到达记录，
    // 也不会因为轮询重合并或旧会话残留而重新冒泡。
    const since = arrivals.get(message.id);
    if (since === undefined || since < bubbleFloor) return null;
    return now < since + BUBBLE_MS ? message.body : null;
  }
  return null;
}

export function kickGuest(targetId: string, nickname: string) {
  const { token, user } = useAccount.getState();
  if (!token || !user) return Promise.reject(new Error("请先登录"));
  return requestFarm<{ ok: boolean }>("/room", {
    method: "POST", headers: { Authorization: "Bearer " + token },
    body: JSON.stringify({ ownerId: String(user.id), targetId, action: "kick" }),
  }).catch((error: unknown) => {
    if (error instanceof FarmApiError) throw new Error(error.message);
    throw error;
  }).then(() => {
    useSocial.setState(state => ({ players: state.players.filter(player => player.id !== targetId) }));
    return nickname;
  });
}

/** 房间切换即清空会话；每 1.6 秒补一次他人消息，页面隐藏时暂停。 */
export function startChatSync() {
  let timer = 0;
  let busy = false;
  // 每次进入游戏（包括同一会话内重新挂载）都重新划一条气泡基线
  bubbleFloor = Date.now();
  const tick = async () => {
    const active = roomNow();
    const room = active?.room ?? null;
    if (useChat.getState().room !== room) {
      seen.clear();
      arrivals.clear();
      primedRoom = null;
      bubbleFloor = Date.now();
      useChat.setState({ room, messages: [], unread: 0, notice: "" });
    }
    if (active && !document.hidden && !busy) {
      busy = true;
      try { await pullChat(); } catch { /* 断线时下一轮再试 */ }
      busy = false;
    }
    timer = window.setTimeout(tick, POLL_MS);
  };
  void tick();
  return () => window.clearTimeout(timer);
}
