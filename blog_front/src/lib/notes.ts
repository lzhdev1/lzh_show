export interface Note {
  id: string;
  title: string;
  tags: string[];
  updatedAt: string;
  content: string;
}

/**
 * 笔记数据（当前为占位示例，可直接替换为真实笔记）。
 * content 支持换行，渲染时按原文保留（whitespace-pre-wrap）。
 */
export const notes: Note[] = [
  {
    id: "next-app-router",
    title: "Next.js App Router 要点",
    tags: ["Next.js", "React", "SSR"],
    updatedAt: "2026-10-28",
    content:
      "App Router 以文件系统路由为基础，page.tsx / layout.tsx / loading.tsx 分别负责页面、布局与加载态。\n\n服务端组件默认在服务端渲染，可以安全读取数据库与密钥；需要交互的部分拆成带 'use client' 的客户端组件。\n\n关键约定：\n- layout 包裹子路由并保持状态（不会因切换子页重挂载）\n- 动态路由用 [slug]，配合 generateStaticParams 可静态化\n- Server Actions 直接在服务端组件中提交表单，无需额外 API\n- next-intl 的 [locale] 布局需要在服务端显式 setRequestLocale，避免两套语言互相串",
  },
  {
    id: "rag-pipeline",
    title: "RAG 检索增强生成笔记",
    tags: ["RAG", "LLM", "Embedding"],
    updatedAt: "2026-10-20",
    content:
      "RAG 的核心链路：文档切分 → 向量化入库 → 检索（召回）→ 重排（Rerank）→ 拼装上下文 → 生成。\n\n踩过的坑：\n- 中文 query 在英文语料上召回差，是因为 embedding 跨语言对齐弱；用 LLM 把 query 翻译成英文再检索，或加一路 BM25 混合检索\n- 分块大小直接影响召回：太小丢语义，太大掺噪声；先按段落分块再用滑动窗口补充\n- 召回后一定要 Rerank，Top-5 里塞进 1-2 条不相关片段会把回答带偏\n- 用 RAGAS 评估：faithfulness 看回答是否忠于上下文，relevancy 看检索是否命中问题",
  },
  {
    id: "langgraph-workflow",
    title: "LangGraph 状态机工作流",
    tags: ["LangGraph", "Agent", "Python"],
    updatedAt: "2026-10-12",
    content:
      "LangGraph 把 Agent 流程建模成图：节点是函数，边是转移条件，State 在节点间传递。\n\n常用结构：\n- 单 Agent：LLM 节点 + 工具调用循环，边判断是否继续\n- 多 Agent：规划者节点先拆任务，再分发到执行者子图\n- 条件分支：根据结果走不同边（比如重试、回退、结束）\n\n调试技巧：给每个节点加 trace 日志，用 langgraph debugger 看状态迁移；State 里只放需要跨节点共享的字段，避免把大对象塞进状态导致每次拷贝开销",
  },
  {
    id: "docker-compose",
    title: "Docker Compose 部署实践",
    tags: ["Docker", "DevOps", "部署"],
    updatedAt: "2026-09-30",
    content:
      "Compose 是本地开发与单机部署的利器：一个文件定义服务、网络、卷，一条命令起整套环境。\n\n实践要点：\n- 前端 Next.js 容器用 volume 挂源码 + WATCHPACK_POLLING=true 才能在容器内热更新\n- 服务间用服务名通信（db、backend），端口映射只暴露到宿主\n- 依赖关系用 depends_on + healthcheck，避免数据库没就绪就启动后端\n- .env 管理密钥，别提交到 git；生产环境用 restart: unless-stopped",
  },
  {
    id: "react-perf",
    title: "React 性能优化清单",
    tags: ["React", "性能"],
    updatedAt: "2026-09-15",
    content:
      "性能优化按收益排序：\n1. 避免无意义重渲染：状态提升到真正需要的层级，别把整个页面状态放顶层\n2. useMemo / useCallback 只在计算重或引用稳定影响子组件 memo 时用，滥用反而增加内存\n3. 列表渲染给稳定 key；长列表用虚拟滚动\n4. 图片懒加载 + 占位（next/image 的 blur 占位）\n5. 动画用 transform/opacity 触发合成层，避免布局抖动\n\n先测量再优化：React DevTools Profiler 看火焰图，找出真正慢的组件，而不是凭感觉 memo",
  },
  {
    id: "postgres-sqlalchemy",
    title: "PostgreSQL 与 SQLAlchemy",
    tags: ["PostgreSQL", "SQLAlchemy", "后端"],
    updatedAt: "2026-09-05",
    content:
      "SQLAlchemy 2.0 的推荐写法：\n- 用 Mapped 与 mapped_column 声明式定义模型，类型注解齐全\n- 会话用 contextmanager 管理（with session.begin():），异常自动回滚\n- 查询用 select() 链式构造，避免裸字符串拼接（防注入）\n\n常用索引策略：WHERE 频繁的字段建普通索引，LIKE '%xx%' 用 pg_trgm，JSON 字段用 GIN。\n\n事务边界要短：把耗时操作移出事务，避免长事务占用连接与锁",
  },
];
