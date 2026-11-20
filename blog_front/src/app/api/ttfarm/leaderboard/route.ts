import { currentUser } from "@/lib/ttfarm-auth";
import { db } from "@/lib/ttfarm-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });

  try {
    const { rows } = await db().query(
      `WITH leaders AS (
         SELECT s.user_id, u.nickname, s.coins
           FROM farm_states s
           JOIN users u ON u.id = s.user_id
          ORDER BY s.coins DESC, s.user_id
          LIMIT 10
       )
       SELECT user_id::text AS "userId", nickname, coins::float8 AS coins,
              (rank() OVER (ORDER BY coins DESC))::int AS rank,
              user_id = $1::bigint AS "isMe"
         FROM leaders
        ORDER BY leaders.coins DESC, user_id`,
      [user.userId]
    );
    return Response.json({ entries: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[ttfarm] 读取金币榜失败", error);
    return Response.json({ error: "金币榜暂时无法读取" }, { status: 500 });
  }
}
