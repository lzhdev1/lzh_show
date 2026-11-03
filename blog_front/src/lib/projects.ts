// 作品数据模型与占位数据
// 说明：M2 阶段使用本地占位数据，字段结构即未来后端 API 的契约（M3 接入）
// title/summary/content 按 locale 提供双语内容

export type Locale = "zh" | "en";

export interface Project {
  /** 唯一标识，用于路由 /projects/[slug] */
  slug: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  /** 技术栈标签 */
  techStack: string[];
  /** 是否在首页精选展示 */
  featured: boolean;
  /** 完成时间（ISO 格式） */
  date: string;
  /** 封面图 URL（真实作品截图；为空时使用 coverGradient 渐变占位封面） */
  cover?: string;
  /** 渐变封面配色（Tailwind 渐变类，无 cover 图时渲染） */
  coverGradient: string;
  links: {
    demo?: string;
    source?: string;
  };
  /** 详情页长文（Markdown 占位） */
  content: Record<Locale, string>;
}

export const projects: Project[] = [
  {
    slug: "blog-agent-platform",
    title: {
      zh: "图文 Blog 生成 Agent 平台",
      en: "Blog Generation Agent Platform",
    },
    summary: {
      zh: "面向内容创作者的 AI 写作平台：输入主题即可生成图文并茂的博客文章，支持 RAG 知识增强与一键发布。",
      en: "An AI writing platform for content creators: generate illustrated blog posts from a topic, with RAG knowledge enhancement and one-click publishing.",
    },
    techStack: ["Next.js", "FastAPI", "RAG", "LangGraph", "PostgreSQL"],
    featured: true,
    date: "2026-06",
    coverGradient: "from-teal-500 to-blue-600",
    links: {
      demo: "https://lzhshow.top",
      source: "https://github.com/lzhdev1",
    },
    content: {
      zh: "## 项目简介\n\n（占位内容，M3 接入后端后替换为真实数据）\n\n- 支持主题输入 → 大纲 → 图文生成全流程\n- RAG 知识库增强写作素材\n- 前后端分离，Docker 部署",
      en: "## Overview\n\n(Placeholder content, to be replaced with real data in M3)\n\n- End-to-end pipeline: topic → outline → illustrated article\n- RAG knowledge base for richer writing material\n- Separated frontend/backend, Docker deployment",
    },
  },
  {
    slug: "rag-assistant",
    title: {
      zh: "RAG 智能问答助手",
      en: "RAG Q&A Assistant",
    },
    summary: {
      zh: "基于向量检索与重排的文档问答系统，支持多格式文档解析、BM25/向量混合检索与 Rerank 精排。",
      en: "A document Q&A system powered by vector search and reranking, with multi-format document parsing, hybrid BM25/vector retrieval and rerank.",
    },
    techStack: ["Python", "FastAPI", "ChromaDB", "Rerank", "Docker"],
    featured: true,
    date: "2026-08",
    coverGradient: "from-violet-500 to-fuchsia-600",
    links: {
      source: "https://github.com/lzhdev1",
    },
    content: {
      zh: "## 项目简介\n\n（占位内容，M3 接入后端后替换为真实数据）\n\n- 支持 PDF/Markdown 等多格式文档入库\n- 混合检索 + Rerank 精排提升答案质量\n- RAGAS 评估检索与生成效果",
      en: "## Overview\n\n(Placeholder content, to be replaced with real data in M3)\n\n- Ingest PDF/Markdown and more document formats\n- Hybrid retrieval + rerank for better answers\n- RAGAS evaluation for retrieval and generation quality",
    },
  },
  {
    slug: "reid-distillation",
    title: {
      zh: "ReID 模型蒸馏研究",
      en: "ReID Distillation Research",
    },
    summary: {
      zh: "毕业论文课题：集成教师 + 低秩 SVD + 向量距离损失的 ReID 模型蒸馏优化，在 Market1501 上压缩模型同时保持 mAP。",
      en: "Thesis topic: ReID distillation with ensemble teachers, low-rank SVD and vector distance loss, compressing models while preserving mAP on Market1501.",
    },
    techStack: ["Python", "PyTorch", "OSNet", "ReID"],
    featured: false,
    date: "2026-10",
    coverGradient: "from-emerald-500 to-teal-600",
    links: {},
    content: {
      zh: "## 研究简介\n\n（占位内容，M3 接入后端后替换为真实数据）\n\n- BoT-R50 / OSNet 集成教师蒸馏\n- 低秩 SVD 压缩学生网络\n- 向量距离损失提升特征判别力",
      en: "## Overview\n\n(Placeholder content, to be replaced with real data in M3)\n\n- Ensemble distillation from BoT-R50 / OSNet teachers\n- Low-rank SVD compression for the student\n- Vector distance loss for discriminative features",
    },
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getFeaturedProjects(): Project[] {
  return projects.filter((p) => p.featured);
}
