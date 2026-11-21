import { accountColumns, accountName, accountSnapshot, issueSession, type AccountUser } from "@/lib/ttfarm-auth";
import { bodyOf, FarmError, farmResponse, transaction } from "@/lib/ttfarm-http";

export async function POST(req: Request) {
  return farmResponse(async () => {
    const body = await bodyOf(req);
    const username = accountName(body.username);
    return transaction(async (client) => {
      const {rows} = await client.query<AccountUser>(`UPDATE users AS u SET last_login_at=now()
        WHERE u.username=$1 RETURNING ${accountColumns}`, [username]);
      const user = rows[0];
      if (!user) throw new FarmError(404, "账号尚未创建", {code:"ACCOUNT_NOT_FOUND"});
      return {...await accountSnapshot(client,user), token:await issueSession(client,user.id)};
    });
  });
}
