# 售后工单 Agent

一个可交互的电商换货作品。访客可以选订单、用自然语言申请换货、阅读引用条款、检查工具调用，并在确认后拿到工单号。作品集详情在 `/projects/aftercare-agent`，演示在 `/aftercare`。

## 试办一笔换货

1. 在首页选择「耳机同款换货」。商城有两笔同款订单，助手会请你补充颜色或订单号。
2. 回复「曜石黑那副」，查看草稿中的 AC-1001，展开政策条款和库存查询记录。
3. 刷新页面，再点「确认并建单」。记录里可以看到工单号。重复确认同一个草稿只扣减一件库存。
4. 尝试为音箱 AC-1003 和键盘 AC-1004 换货，分别观察旧版政策超期和同规格缺货的处理。

所有商品、政策、库存和工单都是模拟数据。每个浏览器会话都有独立的数据，业务日期固定为 2026-11-20，便于复现期限边界。会话可在七天内恢复，重置按钮只影响当前访客。

## 在 lzh_show 中启动

从仓库根目录执行。共用的 `shared-postgres` 容器需已启动并接在 `shared-db` 网络上。

```sh
python project/AftercareAgent/bootstrap_db.py
docker compose up -d --build aftercare frontend
```

初始化脚本生成项目自己的 `.env`，创建并检查数据库和角色 `aftercare_agent`。再次运行会复用现有凭据。主站在 [localhost:3100](http://localhost:3100/projects/aftercare-agent) 展示作品。Python 服务使用 Compose 内网，浏览器通过主站同域访问。生产配置使用 `docker-compose.prod.yml` 和相同的 URL 路径。

## 接入阿里云百炼

打开本目录的 `.env`，将百炼 API Key 填入 `AFTERCARE_LLM_API_KEY`。已预设北京地域按量付费接口及 `qwen-plus`。其他地域或计费方案请使用与 Key 对应的接口地址。[百炼 Base URL 总览](https://help.aliyun.com/zh/model-studio/base-url)

| 环境变量 | 用途 |
| --- | --- |
| `AFTERCARE_LLM_API_KEY` | 空值时使用本地规则演示。填入有效 Key 后启用云模型工具调用。 |
| `AFTERCARE_LLM_BASE_URL` | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`。 |
| `AFTERCARE_LLM_MODEL` | 默认 `qwen-plus`，可改成已开通且支持工具调用的模型。 |
| `AFTERCARE_LLM_DAILY_TURNS` | 默认 100。全项目每天可尝试云模型的用户消息轮数，按上海时区计。一次消息可能触发多次模型调用，超额后使用本地规则。 |
| `AFTERCARE_DATABASE_URL` | 初始化时生成的专用数据库连接。 |
| `AFTERCARE_WORKER_THREADS` | 每个应用进程的后台处理线程数，默认 2。 |
| `AFTERCARE_MAX_RUNNING` | 同一项目库中的全部进程合计最多同时执行 4 个任务。单进程默认最多执行 2 个。 |
| `AFTERCARE_QUEUE_LIMIT` | 排队和执行中的任务合计默认最多 64 个，达到上限时新提交返回 503。 |
| `AFTERCARE_SESSION_TURNS_PER_MINUTE` | 单会话滚动 60 秒内默认最多接收 12 条新消息，超限返回 429；重复提交同一请求可查询原任务。 |
| `AFTERCARE_JOB_LEASE_SECONDS` | 工作进程领取任务后的租约，默认 60 秒，执行期间定期续约。进程中断后，其他线程可在租约过期后接手。 |
| `AFTERCARE_JOB_MAX_ATTEMPTS` | 每个任务最多领取的次数，默认 2，包含首次执行。耗尽后任务标为失败。 |

修改后从仓库根目录执行 `docker compose up -d --no-deps --force-recreate aftercare`。发送一条消息后，右侧执行记录可以查看模型调用次数、耗时及服务商返回的输入和输出 token。鉴权失败或超时也会记录回退原因。实际费用以百炼账单为准。

## 实现

- `agent.py` 提供工具调用循环，支持查订单、查库存、查工单和检索政策。模型根据返回结果决定下一步，可以发起换货草稿。执行记录保留工具参数和结果。
- `catalog.py` 和 `retrieval.py` 根据下单日期筛选政策版本，用关键词或含领域同义词特征的稀疏 TF-IDF 向量匹配条款。每条引用都能追溯到原文。
- `app.py` 和 `store.py` 管理会话、草稿和工单。确认接口在短事务中重新核验订单和库存，扣减与建单一起提交。工单按会话和草稿去重。
- `worker.py` 从 PostgreSQL 持久队列领取任务。领取、预留模型额度和写回分别使用短事务，等待模型时释放数据库连接和会话行锁。跨进程领取共享并发计数，每次写回都核验租约和会话版本。
- `static/` 提供桌面和手机工作台。浏览器用 HttpOnly 会话 Cookie 查询当前任务，支持刷新、取消和断线重连。

## 一条消息如何恢复

1. 工作台向 `POST /aftercare/api/messages` 提交文本和 `request_id`，携带 `Prefer: respond-async`。服务先保存任务，再以 202 和 `Location` 告知查询地址。同一会话用相同编号和内容重试会得到原任务。旧客户端最多等待 40 秒，尚在处理的任务仍可通过 `Location` 查询。
2. 任务从 `queued` 变为 `running`。同一会话同时只办理一条消息，有冲突的第二条返回 409。工作台刷新后通过 `GET /aftercare/api/session` 续接，也可用 `GET /aftercare/api/jobs/{id}` 单独查询。两者都核对访问者会话。新请求遇到 429 或 503 时依据 `Retry-After` 等待。
3. 通过 `POST /aftercare/api/jobs/{id}/cancel` 取消，或重置会话，都会让旧任务失去写回资格。已发给模型服务商的请求可能产生费用；工作进程在下一次模型调用前重新检查任务状态。
4. 如果进程在预留云额度后退出，接手者通过本地规则从已保存的输入继续办理，并记录 `interrupted_model_turn`。这样即使上一次云请求的计费状态未知，也只预留一轮额度。答复、草稿和 `completed` 在同一事务内提交。达到尝试上限则标为 `failed`，页面允许重新发起。
5. 草稿完成后，访客点击确认才会扣库存、建工单。重复点击和并发确认同一草稿都返回同一张工单。

## 复现评测

在仓库根目录运行下列命令。任务测试在项目专用库内创建临时 schema，使用回环地址上的模拟模型和独立的应用进程，结束后清理。即使主服务配置了百炼 Key，下列命令也可用于离线复现。

```sh
docker compose exec -T aftercare python eval_tasks.py
docker compose exec -T aftercare python eval_agent.py --json
docker compose exec -T aftercare python -m unittest -v test_agent
docker compose exec -T aftercare python eval_budget.py
```

业务回归包含 11 项 HTTP 检查，离线规划评测包含 17 个案例；12 个单元测试覆盖工具调用、检索和兜底。将每日云模型额度设为 1 后，5 个会话并发提交，本地模型端点收到 1 次调用，其余 4 个会话使用规则模式完成响应。若要单独对当前运行服务进行业务回归，可执行 `docker compose exec -T aftercare python eval_flow.py`，该命令会使用当前配置的模型。

本机 Docker 的一次测量结果如下。耗时均含本地 HTTP 往返，模型延迟由测试端点设定。

| 场景 | 观测结果 |
| --- | --- |
| 模型延迟 10 秒，同会话刷新 | 改造前单次刷新 9,999 ms，观测到 1 个持锁的空闲事务。改造后提交 14.3 ms，20 次刷新 P95 为 10.2 ms，取消 9.8 ms。模型等待期间采样到的持锁空闲事务为 0。 |
| 两个服务进程，12 个独立会话同时提交，每次模型调用延迟 300 ms，全局并发设为 2 | 12/12 完成，从提交到客户端观察到完成的 P95 为 2.16 秒。同时进行的模型调用峰值为 2，采样到的应用数据库连接峰值为 13。 |
| 模型收到请求后强制结束测试服务，再重启 | 同一任务领取 2 次，服务端收到 1 次模型调用，消耗 1 轮项目额度。恢复出换货草稿后连续确认两次，只产生 1 张工单，库存减少 1 件。 |
| 两次模型工具调用均返回，在写入草稿前强制结束测试服务 | 恢复后使用本地规则重建草稿，模型端点的总调用次数仍为 2。一次用户消息只计 1 轮额度，重复确认只生成 1 张工单。 |

在同一组 21 条手工标注的模拟问题上，关键词、原版稀疏 TF-IDF 和新版 TF-IDF 的首位命中数分别为 11、17、19。新版把「调拨」「调货」加入库存词表，并按命中的不同表达数计算概念词频。「没有可调拨的货」从无结果变为库存条款第一，「申请需要我先点头吗」的确认条款从第二升至第一，原先首位命中的 17 题均保持正确。剩下两题中，「再按一遍会怎样」仍无结果，「能不能换别的型号」仍把库存条款排在第一。本次调整使用了这组题的错误样例，指标反映这组题的回归表现。
