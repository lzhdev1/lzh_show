"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Common");

  const otherLocale = routing.locales.find((l) => l !== locale) ?? "en";

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      aria-label={t("switchToLabel")}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
    >
      {t("switchTo")}
    </Link>
  );
}
