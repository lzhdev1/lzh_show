import { getTranslations, setRequestLocale } from "next-intl/server";
import { GraduationCap, Briefcase, User } from "lucide-react";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("About");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="mb-10 text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-10">
        {/* 个人简介 */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <User className="h-5 w-5 text-primary" />
            {t("bioTitle")}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t("bio")}</p>
        </section>

        {/* 教育背景 */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <GraduationCap className="h-5 w-5 text-primary" />
            {t("educationTitle")}
          </h2>
          <div className="rounded-xl border bg-card p-5">
            <p className="font-semibold">江汉大学</p>
            <p className="text-sm text-muted-foreground">
              {locale === "zh"
                ? "人工智能 · 硕士研究生（2024 – 2027）"
                : "Artificial Intelligence · M.S. (2024 – 2027)"}
            </p>
          </div>
        </section>

        {/* 求职意向 */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Briefcase className="h-5 w-5 text-primary" />
            {t("careerTitle")}
          </h2>
          <div className="rounded-xl border bg-card p-5">
            <p className="font-semibold">{t("career")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("careerDesc")}
            </p>
          </div>
        </section>

        {/* 经历时间线（占位） */}
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t("timelineTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("timelinePlaceholder")}
          </p>
        </section>
      </div>
    </div>
  );
}
