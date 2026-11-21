import { db } from "@/lib/ttfarm-db";
import { requireUser } from "@/lib/ttfarm-auth";
import { changeFriend, friendList } from "@/lib/ttfarm-friends";
import { bodyOf, farmResponse, transaction } from "@/lib/ttfarm-http";

export async function GET(req: Request) {
  return farmResponse(async () => friendList(db(),(await requireUser(req)).id,new URL(req.url).searchParams.get("q")));
}
export async function POST(req: Request) {
  return farmResponse(async () => {
    const user = await requireUser(req);
    const body = await bodyOf(req);
    return transaction((client) => changeFriend(client,user.id,body));
  });
}
