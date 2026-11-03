"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Common");

  const otherLocale = routing.locales.find((l) => l !== locale) ?? "en";

  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={pathname} locale={otherLocale} aria-label={t("switchToLabel")}>
        {t("switchTo")}
      </Link>
    </Button>
  );
}
