import { requireUser } from "@/lib/ttfarm-auth";
import { checkVisit, playerId } from "@/lib/ttfarm-friends";
import { bodyOf, FarmError, farmResponse, transaction } from "@/lib/ttfarm-http";
import { helpFarm, visitView } from "@/lib/ttfarm-visit";

export async function GET(req: Request) {
  return farmResponse(async () => {
    const query = new URL(req.url).searchParams;
    const mode = query.get("mode"), owner = playerId(query.get("ownerId"));
    const self = (await requireUser(req)).id;
    return transaction(async client => visitView(client,self,owner,await checkVisit(client,self,owner,mode,true)));
  });
}
export async function POST(req: Request) {
  return farmResponse(async () => {
    const self = (await requireUser(req)).id;
    const body = await bodyOf(req), owner = playerId(body.ownerId);
    if (body.mode !== "friend") throw new FarmError(403,"参观模式只读");
    return transaction(async client => {
      if (!await checkVisit(client,self,owner,body.mode,true)) throw new FarmError(403,"农场主尚未授权协作");
      return helpFarm(client,self,owner,body);
    });
  });
}
