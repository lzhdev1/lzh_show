import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // 支持的语言列表，顺序即优先级
  locales: ["zh", "en"],
  // 默认语言为中文（用户母语）
  defaultLocale: "zh",
  // 默认语言不显示前缀：/ 即中文，/en 为英文
  localePrefix: "as-needed",
});
