import { create } from "zustand";
import { FarmApiError, requestFarm } from "../api/client";
import { useAccount } from "./account";
import { useSocial } from "./social";
import { useGame } from "./state";

/** 头顶气泡持续 30 秒；房间历史最多保留 40 条供面板回看 */
export const BUBBLE_MS = 30_000;
export const CHAT_LIMIT = 80;
const KEEP = 40;
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
const seen = new Set<string>();
let primedRoom: string | null = null;

function roomNow() {
  const { token, user } = useAccount.getState();
  if (!token || !user?.nickname) return null;
  const visit = useSocial.getState().visit;
  return { token, room: visit?.ownerId ?? String(user.id) };
}

function remember(message: ChatMessage) {
  if (arrivals.has(message.id)) return;
  // 拉到的历史消息（服务端时间已超过气泡寿命）不补气泡，避免刷新后重播旧发言
  if (Math.abs(Date.now() - message.at) > BUBBLE_MS) return;
  arrivals.set(message.id, Date.now());
}

function merge(previous: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) {
    remember(message);
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
  const selfId = String(useAccount.getState().user?.id ?? "");
  let unread = current.unread;
  for (const message of result.messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    // 首次进入房间拿到的是历史记录，只建基线；自己发的不算未读
    if (!primed || message.userId === selfId) continue;
    unread += 1;
    useGame.getState().notify(`${message.nickname}：${message.body}`, "chat", 9000);
  }
  primedRoom = active.room;
  useChat.setState({ messages: merge(current.messages, result.messages), unread });
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
  useChat.setState(state => ({ messages: merge(state.messages, [result.message]), notice: "" }));
  return result.message;
}

/** 某人当前应该显示的气泡；超过 30 秒返回 null */
export function bubbleText(userId: string, now = Date.now()): string | null {
  const { messages } = useChat.getState();
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.userId !== userId) continue;
    const since = arrivals.get(message.id) ?? message.at;
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
  const tick = async () => {
    const active = roomNow();
    const room = active?.room ?? null;
    if (useChat.getState().room !== room) {
      seen.clear();
      primedRoom = null;
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
