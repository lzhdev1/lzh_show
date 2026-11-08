# TT农场（TTFarm）

浏览器 3D 农场经营小游戏：开地、买种子、播种、浇水、收获、卖菜。
轻量优先——Three.js 单页应用 + nginx 静态容器，作为独立作品接入作品集 `https://lzhshow.top/ttfarm/`。

## 当前状态

- 2026-11-06：完成技术调研与选型，见 [`docs/技术选型.md`](docs/技术选型.md)。
- 2026-11-06：demo 打通（里程碑 M1）。可玩内容：
  - 3D 农场场景（程序化低模：谷仓、水井、栅栏、树、12 块地）；
  - 可操控角色（点击地块自动走过去、WASD/方向键自由走、滚轮缩放）；
  - 开地 → 买种子 → 播种 → 浇水（每次 -18% 生长时间，上限 3 次）→ 成熟 → 收获 → 商店卖菜 → 扩地；
  - 6 种作物（萝卜/白菜/番茄/玉米/草莓/南瓜），按等级解锁，每块地 4 株、4 个生长阶段；
  - 昵称可改、4 套角色形象可换，HUD 与 3D 角色同步切换；
  - localStorage 存档（`ttfarm-save-v1`），离线期间按时间戳继续生长。
- 2026-11-07：改为“并入作品集主站”的发布方式（`blog_front/public/ttfarm/` + `proxy.ts` 改写入口），本地 `/ttfarm/` 已能从主站 3100 直接打开，不再需要独立容器与 8120 端口。
- 2026-11-07：作品卡已接入 `blog_front/src/lib/projects.ts`（`slug: "ttfarm"`，featured，封面用游戏内真实截图 `blog_front/public/covers/ttfarm.png`），首页精选与 `/projects` 列表均已展示。
- 2026-11-07：已完成生产部署，`https://lzhshow.top/ttfarm/` 可直接打开（服务器重建前端镜像，`public/ttfarm/` 随镜像进入运行时）。
- 2026-11-08：相机由正交等距改为**透视 + 自由环绕**（OrbitControls，极角 28°–69°、距离 9–34 限位），拖拽旋转、滚轮缩放、R / 双击复位；WASD 改为按当前相机朝向移动；地面扩到 220×220 以免环绕时露出地平线硬边。

## 技术栈（已定）

Three.js + TypeScript + Vite + Zustand + React（仅 DOM 覆盖层 UI）。**不单独起容器**：静态产物并入作品集主站。

## 目录结构

```
TTFarm/
├── docs/          # 设计与技术文档
├── src/           # 源码（game 纯逻辑 / scene 渲染 / ui 面板）
├── scripts/       # sync-to-site.mjs：把 dist 同步进主站 public/ttfarm
└── public/        # 静态资源（角色头像）
```

## 本地开发与发布

```bash
pnpm install
pnpm dev            # 终端会打印实际地址，默认 http://localhost:5173/ttfarm/（端口占用时顺延）
pnpm typecheck      # tsc --noEmit
pnpm sync-to-site   # 构建并同步到 ../../blog_front/public/ttfarm
```

发布链路：`pnpm sync-to-site` → 提交 `blog_front/public/ttfarm/` → 主站照常 `git pull` + `docker compose -f docker-compose.prod.yml up -d --build`。
游戏是主站的一次静态发布，**同域名、同端口，无独立容器**；`blog_front/src/proxy.ts` 负责把 `/ttfarm`、`/ttfarm/` 改写到 `/ttfarm/index.html`（该路径不参与 next-intl 语言路由）。

`vite.config.ts` 里 `base: "/ttfarm/"`，所有资源路径自带子路径前缀，因此主站不需要任何 nginx 额外配置。
