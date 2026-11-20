import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { listArticles } from "@/lib/articles";
import { getProject, type Locale } from "@/lib/projects";

const tape = [
  "bg-teal-400/50", "bg-violet-400/50", "bg-amber-400/50",
  "bg-sky-400/50", "bg-rose-400/50", "bg-lime-400/50",
];
const tilts = [-1.4, 1.5, -.8, 1.2, -1, 1.6];

export async function NotesWall({ locale }: { locale: Locale }) {
  await connection();
  const t = await getTranslations("Home");
  const articles = await listArticles(locale, "", 6).catch((error: Error) => {
    console.error("Unable to load the home page articles", error.message);
    return null;
  });
  if (!articles?.length) {
    return <p className="text-sm text-muted-foreground">{t(articles ? "noPosts" : "postsUnavailable")}</p>;
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {articles.map((article, index) => (
        <li key={article.slug} className={`animate-notes-float ${index >= 2 ? "hidden sm:block" : ""}`}
          style={{ "--tilt": `${tilts[index]}deg`, "--float-delay": `-${index * 2}s` } as CSSProperties}>
          <Link href={`/posts/${article.slug}`} className="group relative flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-transform hover:-translate-y-1 focus-visible:outline-2">
            <span aria-hidden className={`absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 -rotate-3 rounded-sm ${tape[index]}`} />
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>{getProject(article.projectSlug)?.title[locale] ?? article.tags[0]}</span>
              <time className="shrink-0 tabular-nums" dateTime={article.publishedAt}>{article.publishedAt}</time>
            </div>
            <h3 className="mt-3 text-base font-semibold leading-snug">{article.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.summary}</p>
            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
              <span className="text-xs text-muted-foreground">{article.tags.slice(0, 2).join(" · ")}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
