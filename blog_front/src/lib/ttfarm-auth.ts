import { createHmac, timingSafeEqual } from "node:crypto";

// 轻量登录态：签名串里只带 userId + username，服务端不存 session，
// 现在的诉求是「一个账号直接登录、密码字段先空着」，等要接密码时在这里加校验即可
const SECRET = process.env.TTFARM_TOKEN_SECRET ?? "ttfarm-dev-token-secret";

export interface TokenUser {
  userId: number;
  username: string;
}

export function signToken(user: TokenUser): string {
  const payload = Buffer.from(`${user.userId}:${user.username}`, "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | null): TokenUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expect = createHmac("sha256", SECRET).update(payload).digest("base64url");
  const a = Buffer.from(expect, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const plain = Buffer.from(payload, "base64url").toString("utf8");
  const sep = plain.indexOf(":");
  if (sep < 0) return null;
  const userId = Number(plain.slice(0, sep));
  const username = plain.slice(sep + 1);
  if (!Number.isInteger(userId) || userId <= 0 || !username) return null;
  return { userId, username };
}

/** 从 Authorization: Bearer <token> 里取出登录用户，没登录返回 null */
export function currentUser(req: Request): TokenUser | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyToken(header.slice(7).trim());
}
