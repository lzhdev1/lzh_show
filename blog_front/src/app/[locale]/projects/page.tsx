import { setRequestLocale } from "next-intl/server";
import { ProjectsExplorer } from "@/components/projects-explorer";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ProjectsExplorer />;
}
