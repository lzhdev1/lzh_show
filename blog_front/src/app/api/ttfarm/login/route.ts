import { db } from "@/lib/ttfarm-db";
import { signToken } from "@/lib/ttfarm-auth";
import { findOrCreateUser, loadSave } from "@/lib/ttfarm-save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,16}$/;

/** 登录：账号存在就直接进；不存在就当场建号（前期「一个账号即可登录」，不校验密码） */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { username?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username.trim() : "";

    if (!USERNAME_RE.test(username)) {
      return Response.json(
        { error: "账号名需为 2-16 位中文、字母、数字或下划线" },
        { status: 400 }
      );
    }

    const pool = db();
    const user = await findOrCreateUser(pool, username);
    const state = await loadSave(pool, user.id, user.nickname);

    return Response.json({
      token: signToken({ userId: user.id, username: user.username }),
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatarId: user.avatar_id,
      },
      state,
    });
  } catch (error) {
    console.error("[ttfarm] 登录失败", error);
    return Response.json({ error: "登录失败，请稍后再试" }, { status: 500 });
  }
}
