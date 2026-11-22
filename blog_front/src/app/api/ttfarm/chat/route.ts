import { requireUser } from "@/lib/ttfarm-auth";
import { roomMessages, sayInRoom } from "@/lib/ttfarm-chat";
import { playerId } from "@/lib/ttfarm-friends";
import { bodyOf, farmResponse, transaction } from "@/lib/ttfarm-http";

export async function GET(req: Request) {
  return farmResponse(async () => {
    const query = new URL(req.url).searchParams;
    const owner = playerId(query.get("ownerId"));
    const limit = Number(query.get("limit") ?? 20);
    const self = (await requireUser(req)).id;
    return transaction(client => roomMessages(client, self, owner, limit));
  });
}

export async function POST(req: Request) {
  return farmResponse(async () => {
    const self = (await requireUser(req)).id;
    const body = await bodyOf(req);
    return transaction(client => sayInRoom(client, self, body));
  });
}
