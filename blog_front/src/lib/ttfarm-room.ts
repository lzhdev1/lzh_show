import type { Queryable } from "./ttfarm-auth";
import { playerId } from "./ttfarm-friends";
import { FarmError } from "./ttfarm-http";

/** 请离后 5 分钟内不能重进；只影响这一个农场，好友关系保留。 */
export const KICK_COOLDOWN_MINUTES = 5;

export async function kickVisitor(client: Queryable, self: number, body: Record<string, unknown>) {
  const owner = playerId(body.ownerId);
  if (owner !== self) throw new FarmError(403, "只有农场主可以请离访客");
  const target = playerId(body.targetId);
  if (target === self) throw new FarmError(400, "不能请离自己");
  const presence = await client.query(
    "SELECT 1 FROM farm_presence WHERE user_id=$1 AND owner_id=$2 AND seen_at>now()-interval '12 seconds'",
    [target, self]);
  if (!presence.rowCount) throw new FarmError(404, "对方已经不在你的农场了");
  await client.query(`INSERT INTO farm_room_kicks(owner_id,user_id,until)
    VALUES($1,$2,now()+interval '${KICK_COOLDOWN_MINUTES} minutes')
    ON CONFLICT(owner_id,user_id) DO UPDATE SET until=EXCLUDED.until`, [self, target]);
  await client.query("DELETE FROM farm_presence WHERE user_id=$1 AND owner_id=$2", [target, self]);
  return { ok: true };
}

/** 心跳前的门禁：被请离的访客不能悄悄换条路重连。 */
export async function assertNotKicked(client: Queryable, self: number, owner: number) {
  const kicked = await client.query(
    "SELECT 1 FROM farm_room_kicks WHERE owner_id=$1 AND user_id=$2 AND until>now()", [owner, self]);
  if (kicked.rowCount) throw new FarmError(403, "你已被房主请离，稍后再来串门");
}
