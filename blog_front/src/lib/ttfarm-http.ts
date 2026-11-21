import type { PoolClient } from "pg";
import { db } from "./ttfarm-db";

export class FarmError extends Error {
  constructor(public status: number, message: string, public details: Record<string,unknown> = {}) { super(message); }
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function farmResponse(work: () => Promise<unknown>) {
  const headers = { "Cache-Control": "private, no-store" };
  try { return Response.json(await work(), { headers }); }
  catch (error) {
    if (error instanceof FarmError) return Response.json({ ...error.details, error: error.message }, { status: error.status, headers });
    if (error && typeof error === "object" && "code" in error && error.code === "23505"
        && "constraint" in error && error.constraint === "users_nickname_key_uq")
      return Response.json({code:"NICKNAME_TAKEN", error:"这个昵称已被使用，换一个试试"}, {status:409,headers});
    console.error("[ttfarm]", error);
    return Response.json({ error: "农场服务暂时不可用" }, { status: 500, headers });
  }
}

export async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  const value = await req.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FarmError(400, "请求格式有误");
  return value;
}
