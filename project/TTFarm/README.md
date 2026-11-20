# TT农场（TTFarm）

浏览器 3D 农场经营小游戏：开地、买种子、播种、浇水、收获、卖菜。
游戏以 Three.js 渲染，由作品集主站提供账号和存档接口，生产入口为 `/ttfarm/`。

## 操作与种植

- 电脑端用 WASD 或方向键移动，按住 Shift 奔跑，空格跳跃。按住鼠标左键或右键拖动即可转镜头，也可用 Q / E 左右环绕。滚轮缩放，R 或双击场景复位。
- 触屏左侧摇杆控制方向和步速，推到外圈奔跑。按住摇杆时可用另一根手指在画面上拖动转镜头或按右侧按钮跳跃。在画面上双指捏合缩放。轻点地块会走到地边并打开操作卡。
- 30 块地从第一排开始扩建。天气每 3 分钟轮换，雨天播下的种子自带一次浇水。晴天、多云、阵雨分别可能种出金穗、雾晶和雨珠。收获时按品种入库，出售时分别按普通售价的 2、3、2 倍结算。
- 登录后进度同步到 PostgreSQL。浏览器保留本地进度，种下的变异品种在刷新或跨设备读取存档后继续生长。
- 点击金币框左侧的奖杯查看本服农场主的金币前十，同分并列。
- 点击头像进入角色衣橱，可以在小穗和青禾之间切换。选中套装会换上整套服饰，也可以单独搭配下装和鞋靴。点击「穿戴并保存」后在场景中生效。
- 「农场 → 庭院装饰」中提供三种带光效的套系，可混搭围栏、门、牌匾和字体，并设置最多 12 个字的招牌。角色穿搭和庭院装饰均随账号存档。
- 沿河岸走进浅水可以涉水，进入深水自动切换蛙泳，松开方向键或摇杆会原地踩水。也可以点选水面或对岸。木桥从两端坡道上桥，河中央可以从桥下游过。
- 靠近河岸或走上木桥可听见流水声，阵雨期间全图可听见落雨声。两种声音可在操作说明中独立开关，偏好保存在当前设备。

小穗的走、跑、跳取自卡内基梅隆大学的真人动作捕捉数据。环境声采用 jackthemurray 和 Borgory 发布的 CC0 实地录音，随游戏打包。[动作来源与生成方式](src/scene/MOTION-CREDITS.md) · [溪流录音](https://freesound.org/people/jackthemurray/sounds/433589/) · [雨声录音](https://freesound.org/people/Borgory/sounds/678435/)

## 开发记录

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
- 2026-11-08：相机由正交等距改为**透视 + 自由环绕**（OrbitControls），拖拽旋转、滚轮缩放、R / 双击复位；WASD 改为按当前相机朝向移动；地面扩到 220×220 以免环绕时露出地平线硬边。
- 2026-11-08：视角进一步放开到「贴地到俯视」：距离 5.5–46、极角 16°–84°（`src/game/loop.ts`），构图不再固定在 45° 三分之一处。
- 2026-11-08：主角「小穗」换成贴图化的日系长发少女（`src/scene/character.ts`）：四张可平铺贴图（面部/发丝/上衣/裙布，`public/textures/`）+ `MeshToonMaterial` 三阶卡通明暗 + 背面壳描边，程序化百褶裙、水手领、双马尾与呆毛，走动时发尾与裙摆做次级摆动。另外三套形象仍是低模。
- 2026-11-08：补光效：`view.ts` 加逆光轮廓光（`0xffd9b0`，把角色从背景剥出来）与地面反弹光（`HemisphereLight` 暖色），主光阴影贴图提到 1536；`world.ts` 加 72 点加法混合的暖色光尘，挂到 `World.update` 随主循环飘动。

## 技术栈（已定）

Three.js + TypeScript + Vite + Zustand + React（仅 DOM 覆盖层 UI）。**不单独起容器**：静态产物并入作品集主站。

## 目录结构

```
TTFarm/
├── docs/          # 设计与技术文档
├── src/           # 源码（game 纯逻辑 / scene 渲染 / ui 面板）
├── scripts/       # sync-to-site.mjs：把 dist 同步进主站 public/ttfarm
└── public/        # 静态资源（4 张角色头像 avatars/、4 张角色贴图 textures/）
```

## 本地开发与发布

不再在宿主机装 Node / pnpm，游戏和主站一起跑在 `lzh_show_frontend` 这个容器里：

```bash
# 在仓库根目录执行（首次构建较慢）
docker compose up -d frontend

# 游戏开发地址 http://localhost:5174/ttfarm/ （Vite，改源码自动热更新）
# 主站地址     http://localhost:3100
docker logs -f lzh_show_frontend    # 两个进程的日志都在这里
```

- 依赖只存在容器内（`/ttfarm/node_modules`、`/app/node_modules` 是匿名卷），宿主机不留 `node_modules`
- 已有开发数据库可在仓库根目录用 PowerShell 运行 `Get-Content -Raw project/TTFarm/db/schema.sql | docker exec -i shared-postgres psql -U ttfarm -d ttfarm -v ON_ERROR_STOP=1` 升级。部署工作流会自动应用同一份幂等结构脚本。
- 镜像重建（重装依赖）：`docker compose build frontend` 后 `docker compose up -d frontend`
- 发布：产物由镜像的 builder 阶段自己构建（`vite build` → `public/ttfarm`），随主站镜像一起发布，**不需要本地构建、也不需要 `sync-to-site`**
- `scripts/sync-to-site.mjs` 仅作为手动同步的备用手段保留（需要本机有 Node 才能跑）

发布链路：提交源码 → GitHub Actions SSH 进服务器 → `git reset --hard origin/main` → `docker compose -f docker-compose.prod.yml up -d --build`。游戏是主站的一次静态发布，**同域名、同端口、同容器**；`blog_front/src/proxy.ts` 负责把 `/ttfarm`、`/ttfarm/` 改写到 `/ttfarm/index.html`（该路径不参与 next-intl 语言路由）。

`vite.config.ts` 里 `base: "/ttfarm/"`，所有资源路径自带子路径前缀，因此主站不需要任何 nginx 额外配置。
