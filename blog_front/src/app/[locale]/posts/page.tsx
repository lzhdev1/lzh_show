import type { Metadata } from "next";
import { ArrowRight, Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectCover } from "@/components/project-cover";
import { Link, redirect } from "@/i18n/navigation";
import { getArticle, listArticles } from "@/lib/articles";
import type { Locale } from "@/lib/projects";
import { ArticleMeta, relatedProject } from "./article-meta";
import "./journal.css";

type Params = Promise<{ locale: Locale }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Posts" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function PostsPage({ params, searchParams }: {
  params: Params;
  searchParams: Promise<{ q?: string | string[]; note?: string | string[] }>;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  if (typeof search.note === "string") {
    const linked = await getArticle(locale, search.note);
    if (linked) redirect({ href: `/posts/${linked.slug}`, locale });
  }
  const query = typeof search.q === "string" ? search.q.trim() : "";
  const [articles, t] = await Promise.all([listArticles(locale, query), getTranslations("Posts")]);
  const lead = !query ? articles.find(article => relatedProject(article.projectSlug, locale)?.project?.cover) ?? articles[0] : undefined;
  const leadProject = lead ? relatedProject(lead.projectSlug, locale) : null;
  const entries = articles.filter(article => article !== lead);

  return (
    <div className="journal">
      <div className="journal-frame">
        <header className="journal-masthead">
          <div>
            <h1>{t("title")}</h1>
            <p>{t("subtitle")}</p>
          </div>
          <form method="get" role="search" className="journal-search">
            <Search size={17} aria-hidden />
            <label className="sr-only" htmlFor="post-query">{t("searchPlaceholder")}</label>
            <input key={query} type="search" id="post-query" name="q" defaultValue={query} placeholder={t("searchPlaceholder")} />
            <button type="submit">{t("search")}</button>
          </form>
        </header>

        {lead && (
          <Link href={`/posts/${lead.slug}`} className="journal-lead" aria-labelledby="lead-article-title">
            <div className="journal-lead-copy">
              <ArticleMeta article={lead} projectName={leadProject?.name} />
              <h2 id="lead-article-title">{lead.title}</h2>
              <p>{lead.summary}</p>
              <span className="journal-read">{t("read")} <ArrowRight size={17} aria-hidden /></span>
            </div>
            {leadProject?.project?.cover && (
              <div className={`journal-lead-media ${leadProject.project.coverGradient}`} aria-hidden>
                <ProjectCover project={leadProject.project} className="journal-cover" />
              </div>
            )}
          </Link>
        )}

        {(query || entries.length > 0 || !lead) && (
          <section aria-labelledby="post-list-title" className="journal-index">
            <div className="journal-index-heading">
              <h2 id="post-list-title">{query ? t("results") : t("more")}</h2>
              <span className="journal-total">{t("count", { count: entries.length })}</span>
              {query && <Link className="journal-reset" href="/posts">{t("clear")}</Link>}
            </div>
            {entries.length > 0 ? (
              <ul className="journal-entries">
                {entries.map(article => (
                  <li key={article.slug}>
                    <Link href={`/posts/${article.slug}`} className="journal-entry" aria-labelledby={`journal-${article.slug}`}>
                      <ArticleMeta article={article} projectName={relatedProject(article.projectSlug, locale)?.name} />
                      <div>
                        <h3 id={`journal-${article.slug}`}>{article.title}</h3>
                        <p>{article.summary}</p>
                      </div>
                      <span className="journal-entry-arrow"><ArrowRight size={18} aria-hidden /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="journal-empty">{query ? t("empty") : t("unpublished")}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
