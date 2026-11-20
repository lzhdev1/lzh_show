import { db } from "@/lib/ttfarm-db";
import { currentUser } from "@/lib/ttfarm-auth";
import { loadSave, normalizeSave, saveState } from "@/lib/ttfarm-save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 读存档：只认登录态里的 userId，客户端传什么 id 都不看 */
export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  try {
    const pool = db();
    const found = await pool.query<{ nickname: string }>("SELECT nickname FROM users WHERE id = $1", [user.userId]);
    if (!found.rowCount) return Response.json({ error: "账号不存在" }, { status: 401 });
    const state = await loadSave(pool, user.userId, found.rows[0].nickname);
    return Response.json({ state });
  } catch (error) {
    console.error("[ttfarm] 读存档失败", error);
    return Response.json({ error: "读存档失败" }, { status: 500 });
  }
}

/** 写存档：整份覆盖，字段和数值范围在 normalizeSave 里过一遍 */
export async function PUT(req: Request) {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => null)) as { state?: unknown } | null;
    const save = normalizeSave(body?.state, user.username);
    if (!save) return Response.json({ error: "存档格式不对" }, { status: 400 });

    const pool = db();
    const found = await pool.query<{ nickname: string }>(
      "SELECT nickname FROM users WHERE id = $1",
      [user.userId]
    );
    if (!found.rowCount) return Response.json({ error: "账号不存在" }, { status: 401 });

    save.nickname = save.nickname || found.rows[0].nickname;
    const raw = body!.state as Record<string, unknown>;
    await saveState(pool, user.userId, save, "outfitId" in raw, "decor" in raw, "bottomId" in raw);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[ttfarm] 写存档失败", error);
    return Response.json({ error: "写存档失败" }, { status: 500 });
  }
}
