import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <section className="relative overflow-hidden border-b">
        {/* 背景装饰：网格 + 光晕 */}
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="bg-aurora pointer-events-none absolute inset-0" aria-hidden />
        {/* 遮罩让装饰渐隐到正文背景 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden />

        <div className="relative flex flex-col items-start gap-10 py-20 sm:py-28 md:flex-row md:items-center md:justify-between">
          {/* 左侧文字 */}
          <div className="max-w-2xl">
            <p
              className="animate-fade-up mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
              style={{ "--delay": "0ms" } as React.CSSProperties}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {hero("subtitle")}
            </p>
            <h1
              className="animate-fade-up text-4xl font-bold tracking-tight sm:text-5xl"
              style={{ "--delay": "90ms" } as React.CSSProperties}
            >
              {hero("greeting")}
            </h1>
            <p
              className="animate-fade-up mt-5 max-w-xl text-base leading-relaxed text-muted-foreground"
              style={{ "--delay": "180ms" } as React.CSSProperties}
            >
              {hero("intro")}
            </p>
            <div
              className="animate-fade-up mt-8 flex flex-wrap gap-3"
              style={{ "--delay": "270ms" } as React.CSSProperties}
            >
              <Link
                href="/projects"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                {hero("ctaProjects")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                )}
              >
                {hero("ctaAbout")}
              </Link>
            </div>
          </div>

          {/* 右侧头像徽标（占位，后续替换为真实照片） */}
          <div
            className="animate-fade-up mx-auto shrink-0 md:mx-0"
            style={{ "--delay": "360ms" } as React.CSSProperties}
          >
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              {/* 光环 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-primary/40 to-transparent opacity-20 blur-2xl" aria-hidden />
              <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-teal-500/20 via-transparent to-violet-500/20 blur-xl" aria-hidden />
              {/* 主体 */}
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full border bg-gradient-to-br from-card to-muted shadow-lg sm:h-44 sm:w-44">
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-violet-600 text-white sm:h-36 sm:w-36">
                  <span className="text-3xl font-bold tracking-widest sm:text-4xl">LZH</span>
                </div>
              </div>
              {/* 小装饰点 */}
              <span className="absolute right-2 top-3 h-3 w-3 rounded-full bg-teal-400" aria-hidden />
              <span className="absolute bottom-4 left-1 h-2 w-2 rounded-full bg-violet-400" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* 精选作品 */}
      <section className="py-16">
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
      <section className="pb-20 pt-6">
        <h2 className="mb-8 text-2xl font-bold">{home("skillsTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
