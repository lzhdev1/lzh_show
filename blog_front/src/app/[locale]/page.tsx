import { getTranslations, setRequestLocale } from "next-intl/server";
import ThemeToggle from "@/components/theme-toggle";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // 标记 locale，配合 generateStaticParams 实现静态预渲染
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {t("greeting")}
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      <p className="text-sm text-zinc-400 dark:text-zinc-500">{t("placeholder")}</p>
      <ThemeToggle />
    </main>
  );
}
