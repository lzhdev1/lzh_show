import type { Queryable } from "./ttfarm-auth";
import { checkVisit, playerId } from "./ttfarm-friends";
import { FarmError } from "./ttfarm-http";
import { normalizeRanch, isMountAnimal, MOUNT_UNLOCK_LEVEL } from "@farm-rules/ranch";

function coordinate(value: unknown, limit: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value)>limit) throw new FarmError(400, "角色位置无效");
  return value;
}

export async function peersIn(client: Queryable, owner: number, self: number) {
  const {rows} = await client.query(`SELECT p.user_id::text AS id,u.nickname,u.avatar_id AS "avatarId",s.outfit_id AS "outfitId",
    COALESCE(s.bottom_id,s.outfit_id) AS "bottomId",
    CASE WHEN jsonb_typeof(p.pose->'mount')='object' THEN s.ranch END AS ranch,
    p.pose,EXTRACT(epoch FROM p.seen_at)::float8*1000 AS "lastSeen"
    FROM farm_presence p JOIN users u ON u.id=p.user_id JOIN farm_states s ON s.user_id=p.user_id
    WHERE p.owner_id=$1 AND p.user_id<>$2 AND u.nickname_key IS NOT NULL AND p.seen_at>now()-interval '12 seconds'
      AND (p.owner_id=p.user_id OR EXISTS (SELECT 1 FROM farm_friendships f WHERE f.lo=LEAST(p.user_id,p.owner_id)
        AND f.hi=GREATEST(p.user_id,p.owner_id) AND f.accepted))
    ORDER BY p.user_id`, [owner,self]);
  return rows.map(({ranch,pose,...profile}) => {
    if (!ranch) return {...profile,...pose,mount:null};
    const herd = normalizeRanch(ranch);
    const ride = herd.level >= MOUNT_UNLOCK_LEVEL && herd.animals.find(animal => isMountAnimal(animal)
      && animal.species === pose.mount.species && animal.element === pose.mount.element);
    return {...profile,...pose,mount: ride ? {species: ride.species,element: ride.element} : null};
  });
}

export async function heartbeat(client: Queryable, self: number, body: Record<string,unknown>) {
  const owner = playerId(body.ownerId);
  if (body.mode !== "home" && body.mode !== "friend") throw new FarmError(400, "旁观模式无法加入房间");
  if (body.mode === "home" && owner !== self) throw new FarmError(403, "请选择自己的农场");
  const canHelp = body.mode === "home" || await checkVisit(client,self,owner,"friend",true);
  const candidate = body.mount as Record<string,unknown> | null;
  const mount = candidate && typeof candidate.species === "string" && candidate.species.length<20
    && ((candidate.species === "horse" && candidate.element === null) || (typeof candidate.element === "string" && candidate.element.length<10))
    ? {species: candidate.species, element: candidate.element} : null;
  const pose = {x:coordinate(body.x,256), y:coordinate(body.y,128), z:coordinate(body.z,256), yaw:coordinate(body.yaw,1e8)%(Math.PI*2),
    moving:body.moving === true, running:body.running === true, swimming:body.swimming === true, jumping:body.jumping === true, mount,
    action: typeof body.action === "string" && ["punch","kick","cheer","dance","lie","faint","sit"].includes(body.action) ? body.action : null,
    actionTime: typeof body.actionTime === "number" && Number.isFinite(body.actionTime) ? Math.min(Math.max(body.actionTime, 0), 86400) : 0};
  await client.query(`INSERT INTO farm_presence(user_id,owner_id,pose) VALUES($1,$2,$3)
    ON CONFLICT (user_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,pose=EXCLUDED.pose,seen_at=now()`, [self,owner,pose]);
  const farm = await client.query("SELECT revision FROM farm_states WHERE user_id=$1",[owner]);
  if (!farm.rowCount) throw new FarmError(404, "农场不存在");
  return {peers:await peersIn(client,owner,self),revision:farm.rows[0].revision,canHelp};
}
