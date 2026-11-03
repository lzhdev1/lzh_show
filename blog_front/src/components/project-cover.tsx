import type { ComponentType } from "react";
import { Bot, Boxes, ScanSearch, Sparkles } from "lucide-react";
import { useLocale } from "next-intl";
import type { Project } from "@/lib/projects";

// slug → 封面图标映射（后续可按项目类型扩展）
const coverIcons: Record<string, ComponentType<{ className?: string }>> = {
  "blog-agent-platform": Bot,
  "rag-assistant": Sparkles,
  "reid-distillation": ScanSearch,
};

/**
 * 作品封面：有 cover 图时渲染真实截图，否则渲染渐变占位封面
 */
export function ProjectCover({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) {
  const locale = useLocale();
  const Icon = coverIcons[project.slug] ?? Boxes;

  if (project.cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={project.cover}
        alt={project.title[locale]}
        className={`object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${project.coverGradient} ${className ?? ""}`}
    >
      {/* 装饰：右上光斑 */}
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
      {/* 装饰：左下角大图标 */}
      <Icon className="absolute -bottom-5 -left-4 h-28 w-28 text-white/15" strokeWidth={1.5} />
      {/* 装饰：圆点纹理 */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      {/* 中央主图标 */}
      <Icon
        className="absolute inset-0 m-auto h-14 w-14 text-white/85"
        strokeWidth={1.25}
      />
    </div>
  );
}
