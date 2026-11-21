import type { Queryable } from "./ttfarm-auth";
import { FarmError } from "./ttfarm-http";

export function playerId(raw: unknown) {
  if ((typeof raw !== "string" && typeof raw !== "number") || !/^[1-9]\d*$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)))
    throw new FarmError(400, "玩家编号无效");
  return Number(raw);
}

export async function friendList(client: Queryable, self: number, raw: string | null) {
  const q = raw?.trim();
  if (raw !== null && (!q || Array.from(q).length > 32)) return {users: []};
  const {rows} = await client.query(`SELECT u.id::text,u.nickname,u.avatar_id AS "avatarId",
    CASE WHEN f.accepted THEN 'friend' WHEN f.requested_by=$1 THEN 'outgoing' WHEN f.requested_by IS NOT NULL THEN 'incoming' ELSE 'none' END AS status,
    COALESCE(f.accepted AND CASE WHEN f.lo=$1 THEN f.lo_grants ELSE f.hi_grants END,false) AS grant,
    COALESCE(f.accepted AND CASE WHEN f.lo=$1 THEN f.hi_grants ELSE f.lo_grants END,false) AS "canHelp"
    FROM users u LEFT JOIN farm_friendships f ON f.lo=LEAST($1,u.id) AND f.hi=GREATEST($1,u.id)
    WHERE u.id<>$1 AND u.nickname_key IS NOT NULL AND ${q ? "strpos(u.nickname_key,farm_nickname_key($2))>0" : "f.lo IS NOT NULL"}
    ORDER BY ${q ? "(u.nickname_key=farm_nickname_key($2)) DESC," : ""} f.accepted ASC NULLS LAST,u.nickname_key,u.id
    ${q ? "LIMIT 30" : ""}`, q ? [self,q] : [self]);
  return {users: rows};
}

export async function changeFriend(client: Queryable, self: number, body: Record<string,unknown>) {
  const byName = body.targetNickname !== undefined;
  if (byName && (typeof body.targetNickname !== "string" || Array.from(body.targetNickname).length > 32 || !body.targetNickname.trim()))
    throw new FarmError(400,"请输入玩家昵称");
  const expected = body.targetId === undefined ? undefined : playerId(body.targetId);
  if (!byName && expected === undefined) throw new FarmError(400,"请选择玩家昵称");
  // Hold the owner's display name stable through the friendship or grant write.
  const found = await client.query(`SELECT id FROM users WHERE nickname_key IS NOT NULL AND
    ${byName ? "nickname_key=farm_nickname_key($1)" : "id=$1"} FOR SHARE`, [byName ? body.targetNickname : expected]);
  const target = Number(found.rows[0]?.id);
  if (byName && expected !== undefined && expected !== target) throw new FarmError(409,"对方的昵称已变更，请刷新后再试");
  if (!found.rowCount) throw new FarmError(404,"没有找到这个玩家");
  if (self === target) throw new FarmError(400, "请选择其他玩家");
  const pair = [Math.min(self,target), Math.max(self,target)];
  switch (body.action) {
    case "request": {
      await client.query(`INSERT INTO farm_friendships(lo,hi,requested_by) VALUES($1,$2,$3)
        ON CONFLICT(lo,hi) DO UPDATE SET accepted=true
        WHERE NOT farm_friendships.accepted AND farm_friendships.requested_by<>EXCLUDED.requested_by`,[...pair,self]);
      break;
    }
    case "accept": {
      const result = await client.query("UPDATE farm_friendships SET accepted=true WHERE lo=$1 AND hi=$2 AND requested_by=$3", [...pair,target]);
      if (!result.rowCount) throw new FarmError(409, "好友申请已失效");
      break;
    }
    case "decline":
      await client.query("DELETE FROM farm_friendships WHERE lo=$1 AND hi=$2 AND NOT accepted", pair);
      break;
    case "remove":
      await client.query("DELETE FROM farm_friendships WHERE lo=$1 AND hi=$2", pair);
      await client.query("DELETE FROM farm_presence WHERE (user_id=$1 AND owner_id=$2) OR (user_id=$2 AND owner_id=$1)", pair);
      break;
    case "grant": {
      if (typeof body.allow !== "boolean") throw new FarmError(400, "请指定协作权限");
      const field = self === pair[0] ? "lo_grants" : "hi_grants";
      const result = await client.query(`UPDATE farm_friendships SET ${field}=$3 WHERE lo=$1 AND hi=$2 AND accepted`, [...pair,body.allow]);
      if (!result.rowCount) throw new FarmError(403, "请先添加好友");
      break;
    }
    default: throw new FarmError(400, "未知好友操作");
  }
  return {ok: true};
}

export const rankedFarms = `SELECT s.user_id,u.nickname,s.coins FROM farm_states s JOIN users u ON u.id=s.user_id
  WHERE u.nickname_key IS NOT NULL ORDER BY s.coins DESC,s.user_id LIMIT 10`;

export async function checkVisit(client: Queryable, self: number, owner: number, mode: unknown, lock = false) {
  if (mode === "spectate") {
    const result = await client.query(`SELECT 1 FROM (${rankedFarms}) top WHERE top.user_id=$1`, [owner]);
    if (!result.rowCount) throw new FarmError(403, "仅可从排行榜参观当前上榜农场");
    return false;
  }
  if (mode !== "friend" || self === owner) throw new FarmError(400, "访问模式无效");
  const result = await client.query(`SELECT CASE WHEN lo=$2 THEN lo_grants ELSE hi_grants END AS allowed
    FROM farm_friendships f JOIN users u ON u.id=$2 AND u.nickname_key IS NOT NULL
    WHERE lo=LEAST($1::bigint,$2::bigint) AND hi=GREATEST($1::bigint,$2::bigint) AND accepted` + (lock ? " FOR SHARE OF f" : ""), [self,owner]);
  if (!result.rowCount) throw new FarmError(403, "仅好友可以进入这个农场");
  return Boolean(result.rows[0].allowed);
}
