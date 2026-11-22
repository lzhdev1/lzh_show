import { requireUser } from "@/lib/ttfarm-auth";
import { bodyOf, FarmError, farmResponse, transaction } from "@/lib/ttfarm-http";
import { kickVisitor } from "@/lib/ttfarm-room";

export async function POST(req: Request) {
  return farmResponse(async () => {
    const self = (await requireUser(req)).id;
    const body = await bodyOf(req);
    if (body.action !== "kick") throw new FarmError(400, "未知房间操作");
    return transaction(client => kickVisitor(client, self, body));
  });
}
