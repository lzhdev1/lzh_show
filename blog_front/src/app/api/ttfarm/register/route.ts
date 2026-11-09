import { db } from "@/lib/ttfarm-db";
import { signToken } from "@/lib/ttfarm-auth";
import { initialSave, loadSave } from "@/lib/ttfarm-save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,16}$/;

/** 注册：建一个全新账号并写入初始存档；账号已存在返回 409，让前端提示换一个 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { username?: unknown; password?: unknown }
      | null;
    const username = typeof body?.username === "string" ? body.username.trim() : "";

    if (!USERNAME_RE.test(username)) {
      return Response.json(
        { error: "账号名需为 2-16 位中文、字母、数字或下划线" },
        { status: 400 }
      );
    }

    const pool = db();
    const exists = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (exists.rowCount && exists.rowCount > 0) {
      return Response.json({ error: "这个账号已经有人用了" }, { status: 409 });
    }

    // 密码列现在只占位：前端传了也就空着，不参与登录校验
    const created = await pool.query<{ id: number; username: string; nickname: string; avatar_id: string }>(
      `INSERT INTO users (username, password_hash, nickname, avatar_id, last_login_at)
       VALUES ($1, NULL, $1, 'xiaosui', now())
       RETURNING id, username, nickname, avatar_id`,
      [username]
    );
    const user = created.rows[0];

    const save = initialSave(user.username);
    await pool.query(
      `INSERT INTO farm_states (user_id, coins, xp, plots, seeds, harvest, selected_seed)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)`,
      [
        user.id,
        save.coins,
        save.xp,
        JSON.stringify(save.plots),
        JSON.stringify(save.seeds),
        JSON.stringify(save.harvest),
        save.selectedSeed,
      ]
    );

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
    console.error("[ttfarm] 注册失败", error);
    return Response.json({ error: "注册失败，请稍后再试" }, { status: 500 });
  }
}
