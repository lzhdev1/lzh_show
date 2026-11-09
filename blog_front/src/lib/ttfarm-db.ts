import { Pool } from "pg";

// Next.js 开发模式会反复热重载模块，连接池必须挂在 globalThis 上，
// 否则每次改文件都会新建一堆连接，把 Postgres 的连接数吃光
const globalForDb = globalThis as unknown as { ttfarmPool?: Pool };

export function db(): Pool {
  if (!globalForDb.ttfarmPool) {
    globalForDb.ttfarmPool = new Pool({
      connectionString:
        process.env.TTFARM_DATABASE_URL ??
        process.env.DATABASE_URL ??
        // 本地默认连 shared-postgres（和 RAG / Blog / quantlab 共用一个实例，库各自独立）
        "postgres://ttfarm:ttfarm@shared-postgres:5432/ttfarm",
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.ttfarmPool;
}
