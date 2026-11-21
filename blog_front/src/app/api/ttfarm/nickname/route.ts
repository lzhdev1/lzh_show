import { accountSnapshot, nicknameOf, requireUser } from "@/lib/ttfarm-auth";
import { bodyOf, farmResponse, transaction } from "@/lib/ttfarm-http";

export async function PUT(req: Request) {
  return farmResponse(async () => {
    const nickname = nicknameOf((await bodyOf(req)).nickname);
    return transaction(async client => {
      const user = await requireUser(req,false,client,true);
      if (user.nickname !== nickname) {
        await client.query("UPDATE users SET nickname=$2 WHERE id=$1", [user.id,nickname]);
        await client.query("UPDATE farm_states SET revision=revision+1,updated_at=now() WHERE user_id=$1",[user.id]);
      }
      return accountSnapshot(client,{...user,nickname});
    });
  });
}
