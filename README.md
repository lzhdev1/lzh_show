# lzh_show — 个人作品展示网站（Personal Portfolio Blog）

基于前后端分离架构的个人博客，用于展示个人项目与作品。整个项目采用 Docker 容器化开发与部署。

## 目录结构

```
lzh_show/
├── blog_front/          # 前端工程（Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui）
├── blog_backend/        # 后端工程（技术栈待确认）
├── project/             # 个人项目存放区：未来要在博客上展示的项目统一放这里，一个项目一个子目录
├── docker-compose.yml   # 容器编排入口
├── .gitignore           # Git 忽略规则
└── README.md            # 项目说明
```

## 目录职责

| 目录 | 职责 |
|------|------|
| `blog_front` | 前端应用，负责页面展示与用户交互，与后端通过 API 通信 |
| `blog_backend` | 后端服务，负责业务逻辑、数据存储、API 提供（技术栈待定） |
| `project` | 个人项目仓库，每个待展示项目一个子目录，后续接入博客展示 |

## 前端（blog_front）现状

- **框架**：Next.js 16（App Router）+ TypeScript + Tailwind CSS 4 + shadcn/ui
- **国际化**：next-intl，支持中文（默认，无前缀）/ 英文（`/en` 前缀）
- **主题**：next-themes，明暗切换（跟随系统 / 手动）
- **包管理**：pnpm 12
- **开发模式**：webpack + 文件轮询（Windows bind mount 下热更新可靠）
- 里程碑 M1（工程初始化）已完成；M2（页面骨架）待开发

## Docker 使用

```bash
# 启动前端开发容器（首次构建较慢）
docker compose up -d frontend

# 查看日志
docker logs -f lzh_show_frontend
```

- 前端访问：`http://localhost:3100`（注：本机 3000 被 rag-web 容器占用，临时映射 3100；rag-web 停止后可改回 3000）
- 源码热更新：修改 `blog_front/` 下文件即自动刷新
- 计划编排服务：前端、后端（待定）、数据库（待定）

## 待确认决策点

1. 后端技术栈（建议：FastAPI / Python）
2. 数据库选型（建议：PostgreSQL）
