import { getTranslations, setRequestLocale } from "next-intl/server";
import { PostsExplorer } from "@/components/posts-explorer";
import { notes } from "@/lib/notes";

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ note?: string | string[] }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Posts");
  const initialNoteId = typeof sp.note === "string" ? sp.note : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("count", { count: notes.length })}
        </p>
      </div>

      <div className="flex flex-col">
        <PostsExplorer initialNoteId={initialNoteId} />
      </div>
    </div>
  );
}
