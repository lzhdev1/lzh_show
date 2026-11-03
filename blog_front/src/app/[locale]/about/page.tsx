import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Briefcase,
  GraduationCap,
  FlaskConical,
  User,
  Wrench,
} from "lucide-react";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");

  const timeline = [
    {
      icon: GraduationCap,
      title: t("educationTitle"),
      period: t("educationPeriod"),
      desc: null,
    },
    {
      icon: FlaskConical,
      title: t("researchTitle"),
      period: null,
      desc: t("researchDesc"),
    },
    {
      icon: Wrench,
      title: t("internTitle"),
      period: null,
      desc: t("internDesc"),
    },
    {
      icon: Briefcase,
      title: t("careerTitle"),
      period: null,
      desc: `${t("career")} —— ${t("careerDesc")}`,
    },
  ];

  return (
    <div className="w-full px-4 py-12 sm:px-6 sm:py-16">
      {/* 头部：徽标 + 身份 */}
      <header className="mb-12 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500/30 to-violet-500/30 blur-2xl" aria-hidden />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-violet-600 text-white shadow-lg">
            <span className="text-xl font-bold tracking-widest">LZH</span>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("bio")}</p>
        </div>
      </header>

      {/* 经历时间线 */}
      <section>
        <h2 className="mb-6 text-xl font-semibold">{t("timelineTitle")}</h2>
        <ol className="relative space-y-8 border-l pl-6">
          {timeline.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="relative">
                {/* 时间线节点 */}
                <span className="absolute -left-[34px] flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <div className="rounded-xl border bg-card p-5 transition-colors hover:border-border/60">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{item.title}</h3>
                    {item.period && (
                      <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        {item.period}
                      </span>
                    )}
                  </div>
                  {item.desc && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.desc}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
