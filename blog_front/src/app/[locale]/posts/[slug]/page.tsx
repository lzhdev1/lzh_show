import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getArticle } from "@/lib/articles";
import type { Locale } from "@/lib/projects";
import { ArticleMeta, relatedProject } from "../article-meta";
import "../journal.css";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticle(locale, slug);
  if (!article) notFound();
  return { title: article.title, description: article.summary };
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [article, t] = await Promise.all([getArticle(locale, slug), getTranslations("Posts")]);
  if (!article) notFound();
  const project = relatedProject(article.projectSlug, locale);

  return (
    <div className="journal">
      <div className="journal-frame journal-reader">
        <Link className="journal-back" href="/posts"><ArrowLeft size={16} aria-hidden /> {t("back")}</Link>
        <article>
          <header className="journal-article-head">
            <ArticleMeta article={article} projectName={project?.name} />
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
            {article.tags.length > 0 && (
              <ul aria-label={t("tags")} className="journal-tags">
                {article.tags.map(tag => <li key={tag}>{tag}</li>)}
              </ul>
            )}
          </header>
          <div className="journal-reading-layout">
            <aside>
              <nav aria-labelledby="article-contents" className="journal-contents">
                <h2 id="article-contents">{t("contents")}</h2>
                <ol>
                  {article.sections.map((section, index) => (
                    <li key={index}><a href={`#section-${index + 1}`}>{section.heading}</a></li>
                  ))}
                </ol>
              </nav>
            </aside>
            <div className="journal-prose">
              {article.sections.map((section, index) => (
                <section key={index} id={`section-${index + 1}`} aria-labelledby={`heading-${index + 1}`}>
                  <h2 id={`heading-${index + 1}`}>{section.heading}</h2>
                  {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                  {section.table && (
                    <div className="journal-table" tabIndex={0} role="region" aria-labelledby={`heading-${index + 1}`}>
                      <table aria-labelledby={`heading-${index + 1}`}>
                        <thead><tr>{section.table.columns.map((label, i) => (
                          <th scope="col" key={i}>{label}</th>
                        ))}</tr></thead>
                        <tbody>{section.table.rows.map((row, i) => (
                          <tr key={i}>{row.map((value, j) => <td key={j}>{value}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
              {project && (
                <footer className="journal-related">
                  <span>{t("related")}</span>
                  <Link href={project.href}>{project.name} <ArrowUpRight size={16} aria-hidden /></Link>
                </footer>
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
