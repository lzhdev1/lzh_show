import type { Queryable } from "./ttfarm-auth";
import { checkVisit, playerId } from "./ttfarm-friends";
import { FarmError } from "./ttfarm-http";

/** 一条发言最多 80 个字，1 秒内不能重复刷屏；房间只保留最近 200 条 */
export const CHAT_MAX_LENGTH = 80;
export const CHAT_HISTORY = 20;
export const CHAT_KEEP = 200;
const GUEST_WINDOW = "15 seconds";

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  body: string;
  at: number;
}

async function assertRoom(client: Queryable, self: number, owner: number) {
  if (self === owner) return;
  if (!await checkVisit(client, self, owner, "friend", false))
    throw new FarmError(403, "只有好友可以进入这个农场");
  const presence = await client.query(
    `SELECT 1 FROM farm_presence WHERE user_id=$1 AND owner_id=$2 AND seen_at>now()-interval '${GUEST_WINDOW}'`,
    [self, owner]);
  if (!presence.rowCount) throw new FarmError(403, "先进入这个农场再发言");
}

export async function roomMessages(client: Queryable, self: number, owner: number, limit = CHAT_HISTORY) {
  await assertRoom(client, self, owner);
  const take = Math.min(CHAT_KEEP, Math.max(1, Math.trunc(limit)));
  const { rows } = await client.query(`SELECT c.id::text AS id, c.user_id::text AS "userId", c.nickname, c.body,
      EXTRACT(epoch FROM c.created_at)::float8*1000 AS at
    FROM farm_chat c WHERE c.owner_id=$1 ORDER BY c.created_at DESC LIMIT $2`, [owner, take]);
  const messages: ChatMessage[] = rows.reverse().map(row => ({
    id: String(row.id), userId: String(row.userId), nickname: String(row.nickname),
    body: String(row.body), at: Number(row.at),
  }));
  return { messages };
}

export async function sayInRoom(client: Queryable, self: number, body: Record<string, unknown>) {
  const owner = playerId(body.ownerId);
  await assertRoom(client, self, owner);
  if (typeof body.text !== "string") throw new FarmError(400, "请输入要发送的内容");
  const text = body.text.replace(/\s+/g, " ").trim();
  const length = Array.from(text).length;
  if (length < 1) throw new FarmError(400, "消息不能为空");
  if (length > CHAT_MAX_LENGTH) throw new FarmError(400, `一条消息最多 ${CHAT_MAX_LENGTH} 个字`);
  const recent = await client.query(`SELECT 1 FROM farm_chat WHERE owner_id=$1 AND user_id=$2
    AND created_at>now()-interval '1 second'`, [owner, self]);
  if (recent.rowCount) throw new FarmError(429, "说得太快了，歇一秒再说");
  const profile = await client.query("SELECT nickname FROM users WHERE id=$1", [self]);
  const nickname = String(profile.rows[0]?.nickname ?? "");
  if (!nickname) throw new FarmError(400, "先设置昵称再发言");
  const inserted = await client.query(`INSERT INTO farm_chat(owner_id,user_id,nickname,body)
    VALUES($1,$2,$3,$4) RETURNING id::text AS id, EXTRACT(epoch FROM created_at)::float8*1000 AS at`,
    [owner, self, nickname, text]);
  // 每个房间滚动保留最近 200 条，历史不会无限增长。
  await client.query(`DELETE FROM farm_chat WHERE owner_id=$1 AND id NOT IN (
    SELECT id FROM farm_chat WHERE owner_id=$1 ORDER BY created_at DESC LIMIT ${CHAT_KEEP})`, [owner]);
  const message: ChatMessage = { id: String(inserted.rows[0].id), userId: String(self), nickname,
    body: text, at: Number(inserted.rows[0].at) };
  return { message };
}
