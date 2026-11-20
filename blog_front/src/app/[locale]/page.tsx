import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { ProjectCover } from "@/components/project-cover";
import { HeroBackground } from "@/components/hero-background";
import { HeroActions } from "@/components/hero-actions";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { SectionPager } from "@/components/section-pager";
import { NotesWall } from "@/components/notes-wall";
import { getFeaturedProjects, type Locale } from "@/lib/projects";
import "./featured-projects.css";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const hero = await getTranslations("Hero");
  const home = await getTranslations("Home");
  const projectLabels = await getTranslations("Projects");
  const featured = getFeaturedProjects();
  const language = locale as Locale;

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
          <h1
            className="animate-fade-up max-w-5xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
            style={{ "--delay": "0ms" } as React.CSSProperties}
          >
            {hero("greeting")}
          </h1>

          <p
            className="animate-fade-up max-w-2xl text-lg leading-relaxed text-white/70"
            style={{ "--delay": "90ms" } as React.CSSProperties}
          >
            {hero("intro")}
          </p>

          <HeroActions />
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

      <section
        id="featured-projects"
        aria-labelledby="featured-title"
        className="featured-section scroll-mt-16"
      >
        <div className="featured-inner">
          <div className="featured-heading">
            <h2 id="featured-title">{home("featuredTitle")}</h2>
            <Link href="/projects" className="featured-all">
              {home("viewAll")}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          {featured.length > 0 ? (
            <FeaturedCarousel items={featured.map((project) => ({
              slug: project.slug,
              title: project.title[language],
              content: (
                <Link href={`/projects/${project.slug}`} className="featured-project" aria-label={project.title[language]}>
                  <div className={`featured-media ${project.coverGradient}`}>
                    <ProjectCover project={project} className="featured-cover" />
                  </div>
                  <div className="featured-copy">
                    <time dateTime={project.date} className="featured-date">{project.date.replace("-", ".")}</time>
                    <h3>{project.title[language]}</h3>
                    <p className="featured-summary">{project.summary[language]}</p>
                    <ul className="featured-tech">
                      {project.techStack.slice(0, 4).map((tech) => <li key={tech}>{tech}</li>)}
                    </ul>
                    <span className="featured-detail">{projectLabels("viewDetail")}<ArrowRight size={17} aria-hidden /></span>
                  </div>
                </Link>
              ),
            }))} />
          ) : <p>{projectLabels("empty")}</p>}
        </div>
      </section>

      {/* 板块 3：最新发布的开发记录 */}
      <section className="relative flex min-h-[calc(100vh-4rem)] scroll-mt-16 flex-col justify-center px-4 py-14 sm:px-6">
        {/* 背景：极光渐变，压得很淡，衬托便签纸面 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-aurora opacity-80"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">{home("latestPostsTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {home("latestPostsSubtitle")}
              </p>
            </div>
            <Link
              href="/posts"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {home("viewAll")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Suspense fallback={<div className="min-h-40" aria-hidden />}>
            <NotesWall locale={language} />
          </Suspense>
        </div>
      </section>
    </SectionPager>
  );
}
