import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarDays, ExternalLink, GitBranch } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getProject, projects, type Locale } from "@/lib/projects";
import { ProjectCover } from "@/components/project-cover";

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
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/projects"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 mb-8",
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

      {/* 详细介绍：表格一 */}
      {project.details.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">{t("detailsTitle")}</h2>
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="w-36 px-4 py-2.5 font-semibold sm:w-40">
                    {t("detailsLabel")}
                  </th>
                  <th className="px-4 py-2.5 font-semibold">
                    {t("detailsDesc")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {project.details.map((d) => (
                  <tr key={d.label.zh} className="border-t">
                    <td className="px-4 py-3 align-top font-medium">
                      {d.label[l]}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.value[l]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 更新日志：表格二 */}
      {project.changelog.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">{t("changelogTitle")}</h2>
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="w-24 px-4 py-2.5 font-semibold">
                    {t("colVersion")}
                  </th>
                  <th className="w-28 px-4 py-2.5 font-semibold">
                    {t("colDate")}
                  </th>
                  <th className="px-4 py-2.5 font-semibold">
                    {t("colChanges")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {project.changelog.map((c) => (
                  <tr key={c.version} className="border-t">
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {c.version}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {c.date}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.changes[l].map((ch, i) => (
                        <div key={i} className={i > 0 ? "mt-1" : undefined}>
                          · {ch}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
