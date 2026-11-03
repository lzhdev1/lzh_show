import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Project } from "@/lib/projects";
import { ProjectCover } from "@/components/project-cover";
import { ArrowRight, CalendarDays } from "lucide-react";

export function ProjectCard({ project }: { project: Project }) {
  const locale = useLocale();
  const t = useTranslations("Projects");

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-lg"
    >
      <div className="aspect-video w-full overflow-hidden">
        <ProjectCover
          project={project}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
          {project.title[locale]}
        </h3>
        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
          {project.summary[locale]}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {project.techStack.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {project.date}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            {t("viewDetail")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
