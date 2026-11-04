import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ProjectCard } from "@/components/project-card";
import { HeroBackground } from "@/components/hero-background";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Carousel3D } from "@/components/carousel-3d";
import { SectionPager } from "@/components/section-pager";
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
    <SectionPager className="w-full">
      {/* 板块 1：Hero 银河视频背景 + 玻璃质感铺满整个区域 */}
      <section className="relative scroll-mt-16 overflow-hidden bg-black">
        {/* 银河系视频背景：铺满整个 Hero，无左右 padding */}
        <HeroBackground />
        {/* 玻璃层：铺满整个 Hero，无左右 padding */}
        <div
          className="pointer-events-none absolute inset-0 border-b border-white/10 bg-white/[0.01] backdrop-blur-md"
          aria-hidden
        />
        {/* 玻璃顶部高光反射线 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
          aria-hidden
        />

        {/* 内容：居中显示 */}
        <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 py-24 text-center sm:py-28">
          {/* 状态徽章：玻璃 pill + 呼吸光点 */}
          <p
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/70 backdrop-blur-md"
            style={{ "--delay": "0ms" } as React.CSSProperties}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
            </span>
            {hero("subtitle")}
          </p>

          <h1
            className="animate-fade-up max-w-5xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
            style={{ "--delay": "90ms" } as React.CSSProperties}
          >
            {hero("greeting")}
          </h1>

          <p
            className="animate-fade-up max-w-2xl text-lg leading-relaxed text-white/70"
            style={{ "--delay": "180ms" } as React.CSSProperties}
          >
            {hero("intro")}
          </p>

          <div
            className="animate-fade-up flex flex-wrap items-center justify-center gap-4"
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

        {/* 滚动提示：引导下滑进入 Featured Projects */}
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <div className="animate-hero-scroll flex flex-col items-center gap-1.5 text-white/45">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
              {hero("scroll")}
            </span>
            <ArrowDown className="h-4 w-4" />
          </div>
        </div>
      </section>

      {/* 板块 2：精选作品（进入视口时上滑淡入） */}
      <section
        id="featured-projects"
        className="relative scroll-mt-16 min-h-[calc(100vh-4rem)] px-4 py-16 sm:px-6"
      >
        {/* 背景：七彩水墨涂鸦，cover 放大平铺板块不失真 */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/featured-bg.jpg')",
            backgroundSize: "150%",
            backgroundPosition: "center",
          }}
        />
        {/* 模糊玻璃层：雾化背景涂鸦，透明度高（亮色白15%/暗色黑40%），文字与卡片可读 */}
        <div aria-hidden className="absolute inset-0 backdrop-blur-md bg-white/15 dark:bg-black/40" />
        <div className="relative">
        <ScrollReveal>
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
        </ScrollReveal>
        <ScrollReveal delay={120}>
          <Carousel3D
            items={featured.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          />
        </ScrollReveal>
        </div>
      </section>

      {/* 板块 3：技术栈 */}
      <section className="scroll-mt-16 min-h-[calc(100vh-4rem)] px-4 pb-20 pt-6 sm:px-6">
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
    </SectionPager>
  );
}
