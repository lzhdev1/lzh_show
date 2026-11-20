import type { ArticleSummary } from "@/lib/article-types";
import { getProject, type Locale } from "@/lib/projects";

export function relatedProject(slug: string, locale: Locale) {
  if (slug === "portfolio") {
    return { name: locale === "zh" ? "个人网站" : "Portfolio", href: "/", project: undefined };
  }
  const project = getProject(slug);
  if (!project) return null;
  return { name: project.title[locale], href: `/projects/${project.slug}`, project };
}

export function ArticleMeta({ article, projectName }: { article: ArticleSummary; projectName?: string }) {
  return (
    <div className="journal-meta">
      {projectName && <span className="journal-project-name">{projectName}</span>}
      <time dateTime={article.publishedAt}>{article.publishedAt.replaceAll("-", ".")}</time>
    </div>
  );
}
