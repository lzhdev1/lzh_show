import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";
import { getFeaturedProjects } from "@/lib/projects";

const skills = [
  "Python",
  "FastAPI",
  "Next.js",
  "React",
  "TypeScript",
  "Java",
  "Spring Boot",
  "PyTorch",
  "PostgreSQL",
  "Docker",
  "RAG",
  "LangGraph",
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const hero = await getTranslations("Hero");
  const home = await getTranslations("Home");
  const featured = getFeaturedProjects();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      {/* Hero 区 */}
      <section className="flex flex-col items-start gap-6 py-20 sm:py-28">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {hero("greeting")}
        </h1>
        <p className="text-xl font-medium text-primary">{hero("subtitle")}</p>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          {hero("intro")}
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/projects">
              {hero("ctaProjects")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/about">{hero("ctaAbout")}</Link>
          </Button>
        </div>
      </section>

      {/* 精选作品 */}
      <section className="py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">{home("featuredTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {home("featuredSubtitle")}
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {home("viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </section>

      {/* 技术栈 */}
      <section className="py-12">
        <h2 className="mb-8 text-2xl font-bold">{home("skillsTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
