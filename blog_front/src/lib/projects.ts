// 作品数据模型与占位数据
// 说明：M2 阶段使用本地占位数据，字段结构即未来后端 API 的契约（M3 接入）
// title/summary/content 按 locale 提供双语内容

export type Locale = "zh" | "en";

/** 详细介绍条目（表格行）：模块/能力 + 说明 */
export interface DetailItem {
  label: Record<Locale, string>;
  value: Record<Locale, string>;
}

/** 更新日志条目（表格行）：版本 + 日期 + 更新内容列表 */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: Record<Locale, string[]>;
}

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
  /** 详细介绍（表格展示：模块 + 说明） */
  details: DetailItem[];
  /** 更新日志（表格展示：版本 + 日期 + 更新内容） */
  changelog: ChangelogEntry[];
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
    details: [
      {
        label: { zh: "核心流程", en: "Core Pipeline" },
        value: {
          zh: "主题输入 → 大纲生成 → 图文内容生成 → 一键发布，全流程自动化",
          en: "Topic → outline → illustrated article → one-click publish, fully automated",
        },
      },
      {
        label: { zh: "RAG 知识增强", en: "RAG Enhancement" },
        value: {
          zh: "接入知识库检索，写作素材更丰富、内容更专业",
          en: "Knowledge base retrieval for richer, more professional writing material",
        },
      },
      {
        label: { zh: "技术架构", en: "Architecture" },
        value: {
          zh: "Next.js 前端 + FastAPI 后端 + PostgreSQL 存储，前后端分离",
          en: "Next.js frontend + FastAPI backend + PostgreSQL, separated frontend/backend",
        },
      },
      {
        label: { zh: "部署方式", en: "Deployment" },
        value: {
          zh: "Docker Compose 容器化部署，一键启动整套服务",
          en: "Docker Compose containerized deployment, one-command startup",
        },
      },
    ],
    changelog: [
      {
        version: "v1.1",
        date: "2026-08",
        changes: {
          zh: ["新增 RAG 知识库增强", "支持大纲自定义编辑"],
          en: ["Added RAG knowledge base enhancement", "Custom outline editing"],
        },
      },
      {
        version: "v1.0",
        date: "2026-06",
        changes: {
          zh: ["初始版本：主题输入与图文生成上线", "一键发布到博客"],
          en: ["Initial release: topic input & illustrated generation", "One-click publish to blog"],
        },
      },
    ],
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
    details: [
      {
        label: { zh: "文档解析", en: "Document Parsing" },
        value: {
          zh: "支持 PDF / Markdown / 纯文本等多格式文档入库",
          en: "Ingest PDF / Markdown / plain text and more formats",
        },
      },
      {
        label: { zh: "混合检索", en: "Hybrid Retrieval" },
        value: {
          zh: "BM25 关键词与向量语义双路召回，兼顾精确与泛化",
          en: "BM25 keyword + vector semantic dual recall, balancing precision and recall",
        },
      },
      {
        label: { zh: "Rerank 精排", en: "Reranking" },
        value: {
          zh: "对召回结果重排，显著提升答案相关性",
          en: "Re-rank retrieved passages for significantly better answer relevance",
        },
      },
      {
        label: { zh: "效果评估", en: "Evaluation" },
        value: {
          zh: "RAGAS 框架量化检索与生成质量",
          en: "RAGAS framework for retrieval & generation quality metrics",
        },
      },
    ],
    changelog: [
      {
        version: "v1.1",
        date: "2026-09",
        changes: {
          zh: ["接入 Rerank 精排", "加入 RAGAS 效果评估"],
          en: ["Integrated rerank pipeline", "Added RAGAS evaluation"],
        },
      },
      {
        version: "v1.0",
        date: "2026-08",
        changes: {
          zh: ["初始版本：多格式文档入库与问答上线", "BM25 + 向量混合检索"],
          en: ["Initial release: document ingestion & Q&A", "BM25 + vector hybrid retrieval"],
        },
      },
    ],
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
    details: [
      {
        label: { zh: "蒸馏框架", en: "Distillation" },
        value: {
          zh: "BoT-R50 / OSNet 集成教师蒸馏，知识迁移至轻量学生网络",
          en: "Ensemble teachers (BoT-R50 / OSNet) distill knowledge into a lightweight student",
        },
      },
      {
        label: { zh: "模型压缩", en: "Compression" },
        value: {
          zh: "低秩 SVD 分解压缩学生网络，显著减少参数量",
          en: "Low-rank SVD compression for a much smaller student network",
        },
      },
      {
        label: { zh: "损失设计", en: "Loss Design" },
        value: {
          zh: "向量距离损失增强特征判别力",
          en: "Vector distance loss for more discriminative features",
        },
      },
      {
        label: { zh: "实验验证", en: "Evaluation" },
        value: {
          zh: "Market1501 数据集评估，压缩模型同时保持 mAP",
          en: "Evaluated on Market1501, preserving mAP while compressing",
        },
      },
    ],
    changelog: [
      {
        version: "v0.2",
        date: "2026-11",
        changes: {
          zh: ["加入向量距离损失", "完成首轮消融实验"],
          en: ["Added vector distance loss", "Completed first ablation study"],
        },
      },
      {
        version: "v0.1",
        date: "2026-10",
        changes: {
          zh: ["实验框架搭建：集成教师 + 低秩 SVD 蒸馏管线"],
          en: ["Experiment framework: ensemble teacher + low-rank SVD pipeline"],
        },
      },
    ],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getFeaturedProjects(): Project[] {
  return projects.filter((p) => p.featured);
}
