import { requireUser } from "@/lib/ttfarm-auth";
import { db } from "@/lib/ttfarm-db";
import { playerId } from "@/lib/ttfarm-friends";
import { bodyOf, farmResponse, transaction } from "@/lib/ttfarm-http";
import { heartbeat } from "@/lib/ttfarm-presence";

export async function POST(req: Request) {
  return farmResponse(async () => {
    const user = await requireUser(req);
    const body = await bodyOf(req);
    return transaction((client) => heartbeat(client,user.id,body));
  });
}
export async function DELETE(req: Request) {
  return farmResponse(async () => {
    const user = await requireUser(req);
    const owner = playerId(new URL(req.url).searchParams.get("ownerId"));
    await db().query("DELETE FROM farm_presence WHERE user_id=$1 AND owner_id=$2",[user.id,owner]);
    return {ok:true};
  });
}
