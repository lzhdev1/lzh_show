import { getTranslations, setRequestLocale } from "next-intl/server";
import { PenLine } from "lucide-react";

export default async function PostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Posts");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card/50 py-20 text-center">
        <PenLine className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    </div>
  );
}
