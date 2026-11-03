import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
        <p className="font-medium">{t("tagline")}</p>
        <p>
          © {new Date().getFullYear()} Li Zonghan · {t("rights")} ·{" "}
          {t("builtWith")}
        </p>
      </div>
    </footer>
  );
}
