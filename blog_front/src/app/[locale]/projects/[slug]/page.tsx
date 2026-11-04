import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarDays, ExternalLink, GitBranch } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getProject, projects, type Locale } from "@/lib/projects";
import { ProjectCover } from "@/components/project-cover";
import { ProjectTabs } from "@/components/project-tabs";

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

  const l = locale as Locale;
  const title = project.title[l];
  const summary = project.summary[l];

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {/* 返回按钮：页面左上角 */}
      <Link
        href="/projects"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "absolute left-4 top-4 sm:left-6 sm:top-6",
        )}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t("back")}
      </Link>

      {/* 封面 */}
      <div className="mb-10 overflow-hidden rounded-2xl border shadow-sm">
        <ProjectCover project={project} className="h-52 w-full sm:h-72" />
      </div>

      {/* 标题 / 简介 / 日期 / 技术栈 / 链接：居中展示 */}
      <article className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {summary}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {project.date}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
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
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {project.links.demo && (
              <a
                href={project.links.demo}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants())}
              >
                {tp("visitDemo")}
                <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            )}
            {project.links.source && (
              <a
                href={project.links.source}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <GitBranch className="mr-1 h-4 w-4" />
                {tp("sourceCode")}
              </a>
            )}
          </div>
        )}
      </article>

      {/* 详细介绍 / 更新日志：Tab 切换展示 */}
      <ProjectTabs
        details={project.details.map((d) => ({
          label: d.label[l],
          value: d.value[l],
        }))}
        changelog={project.changelog.map((c) => ({
          version: c.version,
          date: c.date,
          changes: c.changes[l],
        }))}
      />
    </div>
  );
}
