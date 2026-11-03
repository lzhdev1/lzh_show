import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
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
    <div className="w-full px-4 sm:px-6">
      {/* Hero 区 */}
      <section className="relative overflow-hidden border-b">
        {/* 背景装饰：网格 + 光晕 */}
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="bg-aurora pointer-events-none absolute inset-0" aria-hidden />
        {/* 顶部高光线：让 Hero 与导航衔接更精致 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
        {/* 遮罩让装饰渐隐到正文背景 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden />

        <div className="relative flex flex-col items-start gap-14 py-24 sm:py-32 md:flex-row md:items-center md:justify-between">
          {/* 左侧文字 */}
          <div className="max-w-3xl">
            {/* 状态徽章：玻璃拟态 + 呼吸光点 */}
            <p
              className="animate-fade-up mb-6 inline-flex items-center gap-2.5 rounded-full border border-primary/15 bg-card/60 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground shadow-sm backdrop-blur-md"
              style={{ "--delay": "0ms" } as React.CSSProperties}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              {hero("subtitle")}
            </p>
            <h1
              className="animate-fade-up text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
              style={{ "--delay": "90ms" } as React.CSSProperties}
            >
              {hero("greeting")}
            </h1>
            <p
              className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
              style={{ "--delay": "180ms" } as React.CSSProperties}
            >
              {hero("intro")}
            </p>
            <div
              className="animate-fade-up mt-10 flex flex-wrap items-center gap-4"
              style={{ "--delay": "270ms" } as React.CSSProperties}
            >
              {/* 主按钮：品牌渐变 + 发光 + hover 微动效 */}
              <Link
                href="/projects"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110"
              >
                {hero("ctaProjects")}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/about"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "rounded-full",
                )}
              >
                {hero("ctaAbout")}
              </Link>
            </div>
          </div>

          {/* 右侧徽标：旋转渐变光环 + 玻璃高光 */}
          <div
            className="animate-fade-up mx-auto shrink-0 md:mx-0"
            style={{ "--delay": "360ms" } as React.CSSProperties}
          >
            <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
              {/* 旋转渐变光环 */}
              <div
                className="animate-spin-slower absolute -inset-4 rounded-full bg-[conic-gradient(from_0deg,transparent_0%,teal-400_15%,transparent_35%,violet-500_60%,transparent_85%)] opacity-60 blur-[6px]"
                aria-hidden
              />
              {/* 柔和光晕 */}
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500/25 via-violet-500/20 to-transparent blur-2xl"
                aria-hidden
              />
              {/* 主体 */}
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-violet-600 shadow-2xl shadow-violet-500/20 sm:h-48 sm:w-48">
                {/* 内圈渐变高光（玻璃质感） */}
                <div
                  className="absolute inset-1 rounded-full bg-[conic-gradient(from_210deg,transparent_0%,white_18%,transparent_32%)] opacity-25"
                  aria-hidden
                />
                <span className="relative text-3xl font-bold tracking-widest text-white sm:text-4xl">
                  LZH
                </span>
              </div>
              {/* 装饰浮点：带发光 */}
              <span
                className="absolute right-3 top-4 h-3 w-3 rounded-full bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.8)]"
                aria-hidden
              />
              <span
                className="absolute bottom-6 left-0 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.8)]"
                aria-hidden
              />
              <span
                className="absolute -right-1 bottom-12 h-1.5 w-1.5 rounded-full bg-amber-300/80"
                aria-hidden
              />
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
