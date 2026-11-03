import { getTranslations, setRequestLocale } from "next-intl/server";
import { Newspaper, PenLine } from "lucide-react";

export default async function PostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Posts");

  return (
    <div className="w-full px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* 空状态 */}
      <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-2xl border border-dashed bg-card/50 px-6 py-20 text-center">
        {/* 装饰光晕 */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
          aria-hidden
        />

        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/10 to-violet-500/10">
          <Newspaper className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="relative">
          <p className="text-lg font-medium">{t("empty")}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" />
            {t("subtitle")}
          </p>
        </div>
      </div>
    </div>
  );
}
