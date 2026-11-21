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
    slug: "fund-manager",
    title: { zh: "QuantLab 基金经理 Agent", en: "QuantLab Fund Manager" },
    summary: {
      zh: "跟随一位模拟基金经理的交易日，查看它读了哪些新闻、如何判断板块资金流，以及为什么选择建仓、减仓或持有现金。",
      en: "Follow a paper fund manager through the trading day. See the news it read, the sector flows it tracked, and why it bought, trimmed a position, or stayed in cash.",
    },
    techStack: ["Python", "FastAPI", "React", "PostgreSQL", "Docker"],
    featured: true,
    date: "2026-11",
    cover: "/covers/fund-manager.png",
    coverGradient: "from-emerald-950 to-lime-700",
    links: { demo: "/fund-manager", source: "https://github.com/lzhdev1/AI_finance" },
    content: {
      zh: "从一份研究报告出发，可以核对经理当时能看到的数据、预计的涨跌和对应的模拟申赎。板块指数与基金单位净值分别预测，结果在公布后核验。",
      en: "Open a research report to trace the data available when the manager made a call and the simulated orders that followed. Sector indices and fund unit values are forecast separately and checked against their published outcomes.",
    },
    details: [
      {
        label: { zh: "资金与行为", en: "Sector research" },
        value: { zh: "查看板块资金流和量价证据、经理对交易行为的解释，以及哪些后续走势会推翻判断。", en: "Inspect sector flows, prices and volume alongside competing explanations and the observations that would overturn a call." },
      },
      {
        label: { zh: "模拟申赎", en: "Paper portfolio" },
        value: { zh: "经理在交易日收盘前制定计划，按真实公布的净值结算，同时考虑可赎份额和短期赎回费。", en: "The manager plans before the close and settles at published fund unit values, accounting for redeemable units and short-term fees." },
      },
      {
        label: { zh: "预测与回放", en: "Forecasts and replay" },
        value: { zh: "次日和五个交易日的预测保留首发记录。历史回放可以逐笔复核交易，并将收益与回撤和沪深 300 对照。", en: "One- and five-session forecasts retain their original calls. Historical replays show individual trades and compare returns and drawdowns with the CSI 300." },
      },
    ],
    changelog: [{
      version: "2026.11",
      date: "2026-11",
      changes: {
        zh: ["上线模拟基金经理工作台，开放投研报告、模拟账本与历史回放。"],
        en: ["Published the fund manager workbench with research reports, a paper ledger and historical replays."],
      },
    }],
  },
  {
    slug: "aftercare-agent",
    title: { zh: "售后工单 Agent", en: "Aftercare Agent" },
    summary: {
      zh: "从一句换货请求到一张可核验的工单。试着给出模糊的商品名，看助手如何追问、核对库存并引用对应版本的售后政策。",
      en: "Take an exchange request from a customer message to a verifiable ticket. Try an ambiguous order and inspect the tool calls, stock checks and policy clauses.",
    },
    techStack: ["Python", "FastAPI", "Tool Calling", "PostgreSQL", "RAG"],
    featured: true,
    date: "2026-11",
    cover: "/covers/aftercare-agent.jpg",
    coverGradient: "from-teal-700 to-emerald-400",
    links: { demo: "/aftercare" },
    content: {
      zh: "在独立的模拟订单中试办换货，查看每步工具调用与引用的政策条款，确认后生成工单。",
      en: "Try an exchange on a private set of sample orders, inspect the tools and policy evidence, then confirm the ticket.",
    },
    details: [
      {
        label: { zh: "多轮办理", en: "Conversation" },
        value: { zh: "同款有多笔订单时先核对商品。选定订单后检查售后期限与库存，并展示办理方案。", en: "Clarify ambiguous orders, then check the exchange window and inventory before preparing a proposal." },
      },
      {
        label: { zh: "政策与依据", en: "Policy evidence" },
        value: { zh: "按订单日期匹配政策版本，每条引用都能查看条款原文。", en: "Match policy versions to the purchase date and inspect the text behind each citation." },
      },
      {
        label: { zh: "工单与存储", en: "Ticket storage" },
        value: { zh: "每位访客有独立的模拟订单、库存和工单。确认后写入 PostgreSQL，重复确认同一方案只生成一张工单。", en: "Each visitor gets isolated orders, stock and tickets. PostgreSQL records the confirmed exchange once, even if the request is retried." },
      },
      {
        label: { zh: "后台任务", en: "Background jobs" },
        value: { zh: "发送消息后可以刷新页面查看进度，或取消办理。服务重启后会继续处理排队任务；已启动的模型轮次可用本地规则恢复。", en: "Refresh to check progress or cancel a request. Queued jobs survive restarts. Interrupted model turns can finish using local policy rules." },
      },
    ],
    changelog: [{
      version: "v1.1",
      date: "2026-11",
      changes: {
        zh: ["消息支持后台办理、刷新续接和取消", "增加会话限流、跨进程并发上限及重启恢复"],
        en: ["Track and cancel background jobs across page reloads", "Added per-session rate limits, shared concurrency limits and restart recovery"],
      },
    }, {
      version: "v1.0",
      date: "2026-11",
      changes: {
        zh: ["支持换货对话、政策引用、工具记录和工单确认", "支持离线演示与兼容 OpenAI 工具调用的模型服务"],
        en: ["Exchange conversations with policy evidence, tool history and ticket confirmation", "Offline demo and configurable OpenAI-compatible tool-calling models"],
      },
    }],
  },
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
    cover: "/covers/blog-agent.png",
    coverGradient: "from-teal-500 to-blue-600",
    links: {
      demo: "https://lzhshow.top/blog-agent/",
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
    cover: "/covers/rag-assistant.png",
    coverGradient: "from-violet-500 to-fuchsia-600",
    links: {
      demo: "https://lzhshow.top/rag-assistant/",
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
  {
    slug: "ttfarm",
    title: {
      zh: "TT农场",
      en: "TT Farm",
    },
    summary: {
      zh: "浏览器里的 3D 农场经营小游戏：开地、买种子、播种、浇水、收获、卖菜、扩地。宽幅自由环绕视角，可操控的日系少女角色，点地块它会自己走过去。",
      en: "A lightweight 3D farming game in the browser: clear land, buy seeds, plant, water, harvest, sell and expand. Wide free-orbit camera with a textured anime heroine who walks to whatever plot you tap.",
    },
    techStack: ["Three.js", "TypeScript", "Vite", "Zustand", "React"],
    featured: true,
    date: "2026-11",
    cover: "/covers/ttfarm.jpg",
    coverGradient: "from-lime-500 to-emerald-600",
    links: {
      demo: "/ttfarm/",
      source: "https://github.com/lzhdev1",
    },
    content: {
      zh: "## 项目简介\n\n在山谷农场种植六种作物，跟着天气培育变异品种。账号存档可以跨设备继续。\n\n- 30 块地、6 种作物，按等级逐步解锁\n- 买种子 → 播种 → 浇水 → 收获 → 卖菜 → 扩地的完整循环\n- 点击地块前往，或用键盘、触屏摇杆自由走跑跳\n- 晴天、多云和阵雨各有对应的变异品种\n- 离线期间按时间戳继续生长，刷新不丢进度",
      en: "## Overview\n\nGrow six crops in a mountain valley, raise weather-dependent varieties and continue on another device with your farm account.\n\n- 30 plots and 6 crops, unlocked as you level up\n- Full loop: buy seeds → plant → water → harvest → sell → expand\n- Tap to walk to plots, or walk, run and jump with keyboard or touch controls\n- Sun, cloud and rain each favor a different crop variety\n- Crops keep growing while offline via timestamps; refresh-safe saves",
    },
    details: [
      {
        label: { zh: "玩法循环", en: "Game Loop" },
        value: {
          zh: "买种 → 播种 → 浇水（最多 3 次，每次缩短 18% 生长时间）→ 收获 → 商店卖菜 → 攒钱扩地",
          en: "Buy → plant → water (up to 3 times, each cutting 18% of grow time) → harvest → sell in shop → save up to expand",
        },
      },
      {
        label: { zh: "3D 表现", en: "3D Rendering" },
        value: {
          zh: "可环绕的山谷农场，有流动的河面、木桥和随天气转动的风车。田里的作物经历四个生长阶段，变异后呈现不同的色泽。",
          en: "Orbit the valley farm, follow the river across a wooden bridge and watch the windmill turn as the weather changes. Crops have four growth stages and distinct colors for each variety.",
        },
      },
      {
        label: { zh: "角色系统", en: "Character" },
        value: {
          zh: "小穗使用 VRM 骨骼模型，支持步行、奔跑和跳跃。移动端可以用左手摇杆控制步速，右手同时操作镜头或跳跃。",
          en: "Walk, run and jump with Xiaosui’s animated VRM avatar. On touchscreens the left stick sets your pace while the other hand can orbit the camera or jump.",
        },
      },
      {
        label: { zh: "存档与部署", en: "Save & Deploy" },
        value: {
          zh: "浏览器缓存和 PostgreSQL 账号存档记录作物与品相。离线期间继续生长，游戏随主站容器发布。",
          en: "Browser and PostgreSQL account saves retain crops and varieties. Plants grow while offline and the game ships with the portfolio container.",
        },
      },
    ],
    changelog: [
      {
        version: "v0.4",
        date: "2026-11",
        changes: {
          zh: [
            "新增贴图化的日系长发少女角色：面部、发丝、上衣与裙布四张可平铺贴图，卡通明暗 + 描边，程序化百褶裙、双马尾与呆毛的次级摆动",
            "视角放开到 5.5–46 距离、16°–84° 极角，可以贴地平视、俯视全场，也能远远拉出去看整片农场",
            "补光效：逆光轮廓光把角色从背景里剥出来，地面反弹光提亮暗部，空中加一层加法混合的暖色光尘",
          ],
          en: [
            "New textured anime heroine: four tileable maps (face, hair, blouse, skirt) with toon shading and outlines, plus a procedural pleated skirt, twin tails and ahoge that sway with movement",
            "Camera range widened to 5.5–46 units and 16°–84° polar, so you can graze the ground, look straight down, or pull far back over the farm",
            "Lighting pass: a rim light separates the character from the background, a ground bounce lifts the shadows, and additive warm dust motes drift in the air",
          ],
        },
      },
      {
        version: "v0.3",
        date: "2026-11",
        changes: {
          zh: [
            "相机改为透视投影 + 自由环绕：拖拽旋转、滚轮缩放、R 或双击复位",
            "WASD 跟随当前视角移动，转到任何角度方向键都不会错位",
            "环绕极角与距离限位，地面扩到 220×220，任意角度都不会穿地或露出边界",
          ],
          en: [
            "Camera switched to perspective with free orbit: drag to rotate, wheel to zoom, R or double-click to reset",
            "WASD now follows the current camera orientation at any angle",
            "Polar angle and distance clamped; ground extended to 220×220 so no angle reveals an edge",
          ],
        },
      },
      {
        version: "v0.2",
        date: "2026-11",
        changes: {
          zh: [
            "3D 场景与角色成型：等距相机、谷仓与水井、可操控角色与四套形象",
            "完整经济循环：扩地价 150 起、6 种作物分等级解锁、卖菜结算",
            "存档支持离线生长，刷新后进度不丢",
          ],
          en: [
            "3D scene and character in place: isometric camera, barn and well, controllable character with four avatars",
            "Full economy loop: land expansion from 150 coins, 6 level-gated crops, selling payouts",
            "Save system with offline growth; progress survives refresh",
          ],
        },
      },
      {
        version: "v0.1",
        date: "2026-11",
        changes: {
          zh: ["技术选型定稿：Three.js + TypeScript + Vite + Zustand + React", "完成工程骨架与存档契约设计"],
          en: ["Stack decided: Three.js + TypeScript + Vite + Zustand + React", "Project skeleton and save contract designed"],
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
