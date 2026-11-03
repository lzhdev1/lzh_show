import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // 由 middleware 设置的 locale，若无效则回退到默认语言
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // 动态加载对应语言的消息文件
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
