import "server-only";

import { connection } from "next/server";
import { Pool } from "pg";
import { cache } from "react";
import type { Article, ArticleSummary } from "./article-types";
import type { Locale } from "./projects";

const shared = globalThis as typeof globalThis & { portfolioArticlesPool?: Pool };

function articlesDb() {
  if (!shared.portfolioArticlesPool) {
    const connectionString = process.env.ARTICLES_DATABASE_URL;
    if (!connectionString) throw new Error("ARTICLES_DATABASE_URL is required");
    shared.portfolioArticlesPool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    shared.portfolioArticlesPool.on("error", error => {
      console.error("Idle article database connection failed", error.message);
    });
  }
  return shared.portfolioArticlesPool;
}

const localizedArticles = `
  WITH localized AS (
    SELECT slug, project_slug, published_on, tags,
           CASE $1::text WHEN 'en' THEN en ELSE zh END AS copy
    FROM public.articles
  )`;

const summaryColumns = `
  slug, project_slug AS "projectSlug", to_char(published_on, 'YYYY-MM-DD') AS "publishedAt",
  tags, copy->>'title' AS title, copy->>'summary' AS summary`;

export async function listArticles(locale: Locale, query = "", limit?: number): Promise<ArticleSummary[]> {
  await connection();
  const { rows } = await articlesDb().query<ArticleSummary>(
    `${localizedArticles}
     SELECT ${summaryColumns} FROM localized
     WHERE $2::text = ''
        OR strpos(lower(concat_ws(' ', copy->>'title', copy->>'summary', array_to_string(tags, ' '))), lower($2)) > 0
        OR EXISTS (
          SELECT FROM jsonb_path_query(copy->'sections', 'strict $.** ? (@.type() == "string")') AS phrase
          WHERE strpos(lower(phrase #>> '{}'), lower($2)) > 0
        )
     ORDER BY published_on DESC, slug
     LIMIT $3`,
    [locale, query.trim(), limit ?? null],
  );
  return rows;
}

export const getArticle = cache(async (locale: Locale, slug: string): Promise<Article | null> => {
  await connection();
  const { rows } = await articlesDb().query<Article>(
    `${localizedArticles}
     SELECT ${summaryColumns}, copy->'sections' AS sections FROM localized WHERE slug = $2`,
    [locale, slug],
  );
  return rows[0] ?? null;
});
