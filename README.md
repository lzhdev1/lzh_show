# lzh_show — 个人作品展示网站（Personal Portfolio Blog）

基于前后端分离架构的个人博客，用于展示个人项目与作品。整个项目采用 Docker 容器化开发与部署。

## 目录结构

```
lzh_show/
├── blog_front/          # 前端工程（技术栈待确认，见下方决策点）
├── blog_backend/        # 后端工程（技术栈待确认，见下方决策点）
├── project/             # 个人项目存放区：未来要在博客上展示的项目统一放这里
├── docker-compose.yml   # 容器编排入口（骨架占位，待技术栈确认后补全服务定义）
├── .gitignore           # Git 忽略规则
└── README.md            # 项目说明
```

## 目录职责

| 目录 | 职责 |
|------|------|
| `blog_front` | 前端应用，负责页面展示与用户交互，与后端通过 API 通信 |
| `blog_backend` | 后端服务，负责业务逻辑、数据存储、API 提供 |
| `project` | 个人项目仓库，每个待展示项目一个子目录，后续接入博客展示 |

## Docker 布局规划

- 根目录 `docker-compose.yml` 统一编排所有服务
- `blog_front/`、`blog_backend/` 各自维护自己的 `Dockerfile`（待初始化时创建）
- 计划编排服务：前端服务、后端服务、数据库服务

## 待确认决策点（确认后即可初始化）

1. 前端技术栈（建议：Next.js / React）
2. 后端技术栈（建议：FastAPI / Python）
3. 数据库选型（建议：PostgreSQL）
4. 是否需要 Git 仓库初始化
