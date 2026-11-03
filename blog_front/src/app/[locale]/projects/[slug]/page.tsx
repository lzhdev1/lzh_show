import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarDays, ExternalLink, GitBranch } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getProject, projects, type Locale } from "@/lib/projects";

// 静态生成所有作品详情页
export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.title[locale as Locale],
    description: project.summary[locale as Locale],
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ProjectDetail");
  const tp = await getTranslations("Projects");
  const project = getProject(slug);

  if (!project) {
    notFound();
  }

  const title = project.title[locale as Locale];
  const summary = project.summary[locale as Locale];
  const content = project.content[locale as Locale];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Button variant="ghost" size="sm" className="-ml-2 mb-8" asChild>
        <Link href="/projects">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      <article>
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {project.date}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {project.techStack.map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-muted px-3 py-1 text-sm font-medium"
              >
                {tech}
              </span>
            ))}
          </div>

          {(project.links.demo || project.links.source) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {project.links.demo && (
                <Button asChild>
                  <a
                    href={project.links.demo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("links")} · {tp("visitDemo")}
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              )}
              {project.links.source && (
                <Button variant="outline" asChild>
                  <a
                    href={project.links.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitBranch className="mr-1 h-4 w-4" />
                    {tp("sourceCode")}
                  </a>
                </Button>
              )}
            </div>
          )}
        </header>

        {/* 详情内容（M2 占位渲染，M4 接入 Markdown 渲染） */}
        <div className="prose prose-neutral max-w-none dark:prose-invert">
          {content.split("\n").map((line, i) =>
            line.trim() === "" ? (
              <div key={i} className="h-4" />
            ) : (
              <p key={i} className="text-base leading-relaxed">
                {line}
              </p>
            ),
          )}
        </div>
      </article>
    </div>
  );
}
