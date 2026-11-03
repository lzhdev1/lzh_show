import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
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
      {/* Hero 区：纯黑底 + 玻璃质感 + 全白文字居中 */}
      <section className="relative overflow-hidden border-b bg-black">
        {/* 背景装饰：白细网格 + 彩色光晕（供玻璃面板反射） */}
        <div className="bg-grid-white pointer-events-none absolute inset-0" aria-hidden />
        <div className="bg-aurora-on-dark pointer-events-none absolute inset-0" aria-hidden />

        {/* 中央玻璃面板 */}
        <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-24 sm:px-6">
          <div className="animate-fade-up w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center shadow-[0_0_120px_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:px-14 sm:py-20">
            {/* 玻璃顶部高光反射线 */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
              aria-hidden
            />
            {/* 状态徽章：玻璃 pill + 呼吸光点 */}
            <p
              className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/70 backdrop-blur-md"
              style={{ "--delay": "0ms" } as React.CSSProperties}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
              </span>
              {hero("subtitle")}
            </p>

            <h1
              className="animate-fade-up text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{ "--delay": "90ms" } as React.CSSProperties}
            >
              {hero("greeting")}
            </h1>

            <p
              className="animate-fade-up mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/70"
              style={{ "--delay": "180ms" } as React.CSSProperties}
            >
              {hero("intro")}
            </p>

            <div
              className="animate-fade-up mt-11 flex flex-wrap items-center justify-center gap-4"
              style={{ "--delay": "270ms" } as React.CSSProperties}
            >
              {/* 主按钮：白色玻璃 + hover 发光 */}
              <Link
                href="/projects"
                className="group inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_28px_rgba(255,255,255,0.18)]"
              >
                {hero("ctaProjects")}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              {/* 次按钮：白描边玻璃 */}
              <Link
                href="/about"
                className="inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-sm font-semibold text-white transition-colors duration-300 hover:border-white/30 hover:bg-white/5"
              >
                {hero("ctaAbout")}
              </Link>
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
