import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { db } from "./ttfarm-db";
import { FarmError } from "./ttfarm-http";
import { loadSave } from "./ttfarm-save";

export type Queryable = Pick<Pool, "query">;
export interface AccountUser { id: number; username: string; nickname: string; avatarId: string }
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const legacySecret = process.env.TTFARM_TOKEN_SECRET ?? "ttfarm-dev-token-secret";
export const accountColumns = `u.id::float8 AS id,u.username,
  CASE WHEN u.nickname_key IS NULL THEN '' ELSE u.nickname END AS nickname,u.avatar_id AS "avatarId"`;

export function accountName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,16}$/.test(name)) throw new FarmError(400, "账号名需为 2-16 位中文、字母、数字或下划线");
  return name;
}
export function nicknameOf(value: unknown) {
  const name = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (!name || Array.from(name).length > 16 || /[\p{Cc}\p{Cs}\u061C\u200B\u200E\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/u.test(name)
      || !/[^\p{M}\p{Z}\p{Cf}]/u.test(name))
    throw new FarmError(400, "昵称需为 1 至 16 个可见字符", {code:"INVALID_NICKNAME"});
  return name;
}

export async function accountSnapshot(client: Queryable, user: AccountUser) {
  const state = await loadSave(client,user.id,user.nickname);
  // The farm state joins the user row, so an intervening rename also updates the identity shown to the client.
  return {user:{...user,nickname:state.nickname,avatarId:state.avatarId}, state, needsNickname:!state.nickname};
}

export async function issueSession(client: Queryable, id: number) {
  const token = "farm." + randomBytes(32).toString("base64url");
  await client.query("DELETE FROM farm_sessions WHERE user_id=$1 AND expires_at<=now()", [id]);
  await client.query(`INSERT INTO farm_sessions(token_hash,user_id,protected,expires_at)
    VALUES($1,$2,false,now()+interval '90 days')`, [digest(token), id]);
  return token;
}

// Keep previously signed sessions usable on devices running older clients.
function previousIdentity(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[\w-]+$/.test(parts[0])) return null;
  const expected = createHmac("sha256", legacySecret)
    .update(parts[0]).digest("base64url");
  const sig = Buffer.from(parts[1]);
  if (sig.length !== expected.length || !timingSafeEqual(sig, Buffer.from(expected))) return null;
  const decoded = /^(\d+):([a-zA-Z0-9_\u4e00-\u9fa5]{2,16})$/.exec(Buffer.from(parts[0], "base64url").toString("utf8"));
  return decoded && Number.isSafeInteger(Number(decoded[1])) ? { id: decoded[1], username: decoded[2] } : null;
}

async function currentUser(req: Request, client: Queryable, lock: boolean): Promise<AccountUser | null> {
  const token = /^Bearer ([\w.-]{1,512})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const lockUser = lock ? " FOR UPDATE OF u" : "";
  if (token.startsWith("farm.")) {
    const {rows} = await client.query<AccountUser>(`SELECT ${accountColumns} FROM farm_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now()` + lockUser, [digest(token)]);
    return rows[0] ?? null;
  }
  const legacy = previousIdentity(token);
  if (!legacy) return null;
  const result = await client.query<AccountUser>(`SELECT ${accountColumns} FROM users u WHERE u.id=$1 AND u.username=$2` + lockUser,
    [legacy.id,legacy.username]);
  return result.rows[0] ?? null;
}

export async function requireUser(req: Request, named = true, client: Queryable = db(), lock = false) {
  const user = await currentUser(req, client, lock);
  if (!user) throw new FarmError(401, "请先登录农场");
  if (named && !user.nickname) throw new FarmError(403, "请先为农场主设置昵称", {code:"NICKNAME_REQUIRED"});
  return user;
}
