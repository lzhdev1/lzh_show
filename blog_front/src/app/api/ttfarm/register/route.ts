import { accountColumns, accountName, accountSnapshot, issueSession, nicknameOf, type AccountUser } from "@/lib/ttfarm-auth";
import { bodyOf, FarmError, farmResponse, transaction } from "@/lib/ttfarm-http";

export async function POST(req: Request) {
  return farmResponse(async () => {
    const body = await bodyOf(req);
    const username = accountName(body.username);
    const nickname = nicknameOf(body.nickname);
    return transaction(async (client) => {
      const result = await client.query<AccountUser>(`INSERT INTO users AS u(username,nickname,last_login_at)
        VALUES($1,$2,now()) ON CONFLICT (username) DO NOTHING RETURNING ${accountColumns}`, [username,nickname]);
      const user = result.rows[0];
      if (!user) throw new FarmError(409, "这个账号已存在，请登录", {code:"ACCOUNT_EXISTS"});
      return {...await accountSnapshot(client,user), token:await issueSession(client,user.id)};
    });
  });
}
