import { db } from "@/lib/ttfarm-db";
import { accountSnapshot, requireUser } from "@/lib/ttfarm-auth";
import { bodyOf, FarmError, farmResponse, transaction } from "@/lib/ttfarm-http";
import { loadSave, normalizeSave, saveState } from "@/lib/ttfarm-save";

export async function GET(req: Request) {
  return farmResponse(async () => {
    const user = await requireUser(req,false);
    return accountSnapshot(db(),user);
  });
}

export async function PUT(req: Request) {
  return farmResponse(async () => {
    const body = await bodyOf(req);
    return transaction(async (client) => {
      const user = await requireUser(req,true,client,true);
      const writeId = body.writeId;
      if (writeId !== undefined) {
        if (typeof writeId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(writeId))
          throw new FarmError(400,"存档写入编号无效");
        const previous = await client.query("SELECT revision FROM farm_owner_writes WHERE user_id=$1 AND write_id=$2", [user.id,writeId]);
        if (previous.rowCount) return {ok:true,revision:previous.rows[0].revision};
      }
      const save = normalizeSave(body.state,user.nickname);
      if (!save) throw new FarmError(400, "存档格式不对");
      const raw = body.state as Record<string, unknown>;
      if ("revision" in raw && (!Number.isSafeInteger(raw.revision) || (raw.revision as number)<0)) throw new FarmError(400, "存档版本有误");
      const revision = await saveState(client,user.id,save,"outfitId" in raw,"decor" in raw,"bottomId" in raw,
        "ranch" in raw, "forage" in raw, "garage" in raw, "backpackLevel" in raw,
        typeof raw.revision === "number" ? raw.revision : null, "codexCollected" in raw,
        "fishingRod" in raw || "fishCaught" in raw);
      if (revision === null) throw new FarmError(409,"农场有更新，请载入最新进度", {state:await loadSave(client,user.id,user.nickname)});
      if (writeId) {
        await client.query("INSERT INTO farm_owner_writes(user_id,write_id,revision) VALUES($1,$2,$3)",[user.id,writeId,revision]);
        await client.query("DELETE FROM farm_owner_writes WHERE user_id=$1 AND recorded_at<now()-interval '90 days'",[user.id]);
      }
      return {ok:true,revision};
    });
  });
}
