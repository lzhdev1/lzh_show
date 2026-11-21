import { requireUser } from "@/lib/ttfarm-auth";
import { db } from "@/lib/ttfarm-db";
import { rankedFarms } from "@/lib/ttfarm-friends";
import { farmResponse } from "@/lib/ttfarm-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return farmResponse(async () => {
    const user = await requireUser(req);
    const { rows } = await db().query(
      `WITH leaders AS (${rankedFarms})
       SELECT user_id::text AS "userId", nickname, coins::float8 AS coins,
              (rank() OVER (ORDER BY coins DESC))::int AS rank,
              user_id = $1::bigint AS "isMe"
         FROM leaders
        ORDER BY leaders.coins DESC, user_id`,
      [user.id]
    );
    return {entries: rows};
  });
}
