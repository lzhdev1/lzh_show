"use strict";

const byId = (id) => document.getElementById(id);
const workspace = document.querySelector(".workspace");
const form = byId("composer");
const input = byId("input");
const stageNames = {
  idle: "等待下一步",
  clarifying: "等待补充信息",
  awaiting_confirmation: "等待确认方案"
};
const toolNames = {
  list_orders: "查找订单",
  get_order: "读取订单",
  search_policy: "检索政策",
  check_eligibility: "核对换货条件",
  get_inventory: "查询库存",
  get_tickets: "查询工单",
  model_usage: "模型调用用量",
  model_fallback: "切换至本地规则",
  create_ticket: "登记工单"
};
let session = null;
let activeRequest = null;
let failedRequest = null;
let openDetails = new Set();
let syncVersion = 0;
let syncTimer;
let readController = null;
let failedReads = 0;
let syncAfterWrite = false;
let retryAt = 0;
let cooldownTimer;
const jobLabels = {queued: "排队中", running: "正在处理", completed: "已完成", failed: "处理失败", cancelled: "已取消"};
const otherTabs = typeof BroadcastChannel === "function" ? new BroadcastChannel("aftercare-session") : null;

function jobInProgress(job = session?.job) {
  return job?.status === "queued" || job?.status === "running";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function button(label, className, action) {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ||
    "web-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function switchView(view) {
  workspace.dataset.view = view;
  document.querySelectorAll(".mobile-nav button").forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset.view === view));
  });
}

function brandMark() {
  const mark = el("span", "brand-symbol");
  mark.setAttribute("aria-hidden", "true");
  mark.append(el("i"), el("i"), el("i"));
  return mark;
}

function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || activeRequest || !session || jobInProgress() || Date.now() < retryAt) return;
  switchView("chat");
  const retry = failedRequest?.path === "messages" && failedRequest.body.text === trimmed;
  perform(retry ? failedRequest : {path: "messages", body: {text: trimmed, request_id: requestId()}});
}

function renderOrders() {
  const orders = session.orders || [];
  byId("order-count").textContent = orders.length;
  byId("business-date").textContent = session.today ? "业务日期 " + session.today : "";
  const rows = orders.map((order) => {
    const spec = order.variant || "";
    const row = button(null, "order-row", () => {
      switchView("chat");
      input.value = session.stage === "clarifying" ? order.id : "我想给订单 " + order.id + " 申请同款换货";
      syncControls();
      input.focus();
    });
    if (session.proposal?.order_id === order.id) row.classList.add("is-current");
    row.title = "使用订单 " + order.id + " · 签收 " + order.delivered + " · 库存 " + order.stock;
    row.setAttribute("aria-label", row.title + " · " + order.name + " " + spec);
    const type = order.name.includes("耳机") ? "earbuds" : order.name.includes("音箱") ? "speaker" : order.name.includes("键盘") ? "keyboard" : "generic";
    const icon = el("span", "order-pic " + type + (spec.includes("白") ? " white" : ""));
    icon.setAttribute("aria-hidden", "true");
    icon.append(el("span", "product-shape"));
    const copy = el("span", "order-copy");
    copy.append(el("strong", "", order.name), el("small", "", spec + " · " + order.id));
    row.append(icon, copy);
    return row;
  });
  byId("orders").replaceChildren(...rows);
}

function jumpToCitation(id) {
  switchView("inspector");
  const detail = document.getElementById("citation-" + id);
  if (detail) {
    detail.open = true;
    detail.scrollIntoView({block: "nearest"});
    detail.querySelector("summary").focus({preventScroll: true});
  }
}

function messageNode(message) {
  const user = message.role === "user";
  const row = el("article", "message " + (user ? "user" : "assistant"));
  const meta = el("div", "message-meta");
  if (!user) meta.append(brandMark());
  meta.append(el("span", "", user ? "你" : "Aftercare"));
  row.append(meta, el("div", "message-text", message.text));
  if (message.citations?.length) {
    const links = el("div", "inline-cites");
    message.citations.forEach((cite) => {
      const link = button("§ " + cite.title, "cite-jump", () => jumpToCitation(cite.id));
      link.title = cite.id + " · 查看政策原文";
      links.append(link);
    });
    row.append(links);
  }
  return row;
}

function welcomeNode(messages) {
  const box = el("div", "welcome");
  const art = el("div", "welcome-art");
  art.setAttribute("aria-hidden", "true");
  const initial = messages.find((message) => message.role === "assistant");
  box.append(art, el("h2", "", "有什么售后问题？"), el("p", "", initial?.text || "描述想换的商品，或选择下方的问题开始。"));
  const suggestions = el("div", "suggestions");
  for (const [label, text] of [
    ["耳机同款换货 ↗", "帮我换一下耳机，还是同款"],
    ["音箱还能换吗？ ↗", "我想给订单 AC-1003 的便携音箱换货"],
    ["键盘换货 ↗", "我想给订单 AC-1004 的机械键盘换货"]
  ]) suggestions.append(button(label, "suggestion", () => sendMessage(text)));
  box.append(suggestions);
  return box;
}

function renderConversation(scrollToEnd) {
  const box = byId("conversation");
  const messages = session?.messages || [];
  const job = session?.job;
  let pendingText = job && job.status !== "completed" ? job.text : "";
  if (activeRequest?.path === "messages") pendingText = activeRequest.body.text;
  const hasUser = messages.some((message) => message.role === "user");
  const children = !hasUser && !pendingText ? [welcomeNode(messages)] : messages.map(messageNode);
  if (pendingText) children.push(messageNode({role: "user", text: pendingText}));
  if (activeRequest?.path === "messages" || activeRequest?.path === "confirm") {
    children.push(el("p", "pending", activeRequest.path === "confirm" ? "正在登记工单…" : "正在提交请求…"));
  }
  box.replaceChildren(...children);
  if (scrollToEnd) box.scrollTop = box.scrollHeight;
}

function renderJob() {
  const box = byId("job-banner");
  const job = session.job;
  box.hidden = !job || job.status === "completed";
  box.replaceChildren();
  const progress = byId("job-progress");
  progress.hidden = !job;
  if (!job) return;
  const label = jobLabels[job.status] || "状态更新中";
  progress.textContent = "最近任务 · " + label + (job.attempts > 0 ? " · 第 " + job.attempts + " 次执行" : "")
    + (jobInProgress(job) ? "。本轮工具记录将在任务完成后显示。" : "");
  if (job.status === "completed") return;
  box.append(el("strong", "", "本次请求" + label));
  if (jobInProgress(job)) {
    box.append(button("查看进度", "", () => {
      switchView("inspector");
      byId("progress").focus();
    }), button("刷新", "job-refresh", refreshSession), button("取消请求", "job-action", () => perform({
      path: "jobs/" + encodeURIComponent(job.id) + "/cancel", body: {request_id: requestId()}
    })));
  } else if (job.status === "failed") {
    if (job.text) box.append(button("重新发送", "job-action", () => perform({
      path: "messages", body: {text: job.text, request_id: requestId()}
    })));
    const reason = job.error === "lease_expired" ? "服务中断后已达到尝试上限。"
      : "多次处理未能完成。你可以重新发送本次请求。";
    box.append(el("span", "job-failure", reason));
  }
}

function renderProposal() {
  const box = byId("proposal");
  box.replaceChildren();
  const proposal = session?.proposal;
  if (!proposal) return;
  const card = el("div", "proposal-card");
  const info = el("div", "proposal-info");
  info.append(el("strong", "", "确认同规格换货"), el("small", "", [proposal.order_id, proposal.name].filter(Boolean).join(" · ")));
  card.append(info, button("取消", "quiet-button", () => sendMessage("取消换货")),
    button("确认并建单", "confirm-button", () => perform({path: "confirm", body: {proposal_id: proposal.id, request_id: requestId()}})));
  box.append(card);
}

function detailNode(key, className, label, body) {
  const details = el("details", className);
  details.open = openDetails.has(key);
  details.append(el("summary", "", label), body);
  details.addEventListener("toggle", () => {
    if (details.isConnected) {
      if (details.open) openDetails.add(key);
      else openDetails.delete(key);
    }
  });
  return details;
}

function pretty(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function fallbackText(reason) {
  if (reason === "missing_exchange_evidence") return "模型已回复，换货所需的订单、库存或政策依据尚不完整，本轮由本地规则复核。";
  if (reason === "http_401" || reason === "http_403") return "模型服务拒绝了本次访问，请核对密钥和模型权限。";
  if (reason === "daily_turn_limit") return "今日模型调用额度已用完，已由本地规则继续处理。";
  if (reason === "interrupted_model_turn") return "服务恢复后，本轮已用本地规则完成，避免重复调用云模型。";
  if (reason === "recovered_offline_turn") return "已按任务开始时的本地规则模式恢复办理。";
  if (reason === "timeout") return "模型请求超时，已由本地规则继续处理。";
  if (reason === "http_429") return "模型服务限流，已由本地规则继续处理。";
  return "模型请求未完成，已由本地规则继续处理。";
}

function renderInspector() {
  const citations = new Map();
  const records = [];
  for (const message of session.messages) {
    for (const citation of message.citations || []) citations.set(citation.id, citation);
    if (message.trace?.length) records.push(...message.trace);
    else for (const tool of message.tools || []) records.push({tool});
  }
  const tickets = session.tickets || [];
  byId("stage").textContent = session.stage === "idle" && !session.messages.some((message) => message.role === "user")
    ? "等待受理" : stageNames[session.stage] || "会话进行中";
  byId("citation-count").textContent = citations.size;
  const refs = Array.from(citations.values(), (cite) => {
    const details = detailNode("cite-" + cite.id, "citation", cite.title, el("p", "", cite.id + " · " + cite.text));
    details.id = "citation-" + cite.id;
    return details;
  });
  byId("citations").replaceChildren(...(refs.length ? refs : [el("p", "empty-note", "办理时引用的条款将在这里显示。")]));
  byId("trace-count").textContent = records.length;
  const trace = records.map((entry, index) => {
    const name = toolNames[entry.tool] || entry.tool;
    const label = entry.source === "server_check" ? name + "（系统补查）" : name;
    if (entry.args === undefined && entry.result === undefined) return el("div", "trace-item", label);
    const parts = [String(entry.tool)];
    if (entry.tool === "model_usage" && entry.result) {
      const usage = entry.result;
      parts.push("模型调用 " + usage.calls + " 次 · 用时 " + usage.elapsed_ms + " ms");
      if (usage.prompt_tokens != null) parts.push("输入 " + usage.prompt_tokens + " tokens");
      if (usage.completion_tokens != null) parts.push("输出 " + usage.completion_tokens + " tokens");
    } else {
      if (entry.tool === "model_fallback") parts.push(fallbackText(entry.result?.reason));
      if (entry.args !== undefined) parts.push("输入\n" + pretty(entry.args));
      if (entry.result !== undefined) parts.push("结果\n" + pretty(entry.result));
    }
    return detailNode("trace-" + index, "trace-detail", String(index + 1).padStart(2, "0") + "  " + label, el("pre", "", parts.join("\n\n")));
  });
  byId("trace").replaceChildren(...(trace.length ? trace : [el("p", "empty-note", "尚无已完成的工具记录。")]));
  byId("ticket-count").textContent = tickets.length;
  const ticketNodes = tickets.map((ticket) => {
    const node = el("div", "ticket");
    node.append(el("strong", "", ticket.id), el("div", "", ticket.name), el("small", "", ticket.order_id));
    return node;
  });
  byId("tickets").replaceChildren(...(ticketNodes.length ? ticketNodes : [el("p", "empty-note", "确认换货方案后生成工单。")]));
}

function syncControls() {
  const busy = Boolean(activeRequest);
  const coolingDown = Date.now() < retryAt;
  const blocked = busy || !session || jobInProgress() || coolingDown;
  byId("send").disabled = blocked || !input.value.trim();
  byId("reset").disabled = busy || !session || coolingDown;
  input.disabled = !session || activeRequest?.path === "messages";
  document.querySelectorAll(".order-row, .shortcut, .suggestion, .proposal-card button").forEach((control) => { control.disabled = blocked; });
  document.querySelectorAll(".job-action, .job-refresh, #error button, #sync-notice button").forEach((control) => { control.disabled = busy || coolingDown; });
  form.setAttribute("aria-busy", String(busy || jobInProgress()));
}

function showError(text, request) {
  const error = byId("error");
  failedRequest = request;
  error.hidden = false;
  error.replaceChildren(el("span", "", text));
  if (request) error.append(button("重试", "", () => {
    if (failedRequest) perform(failedRequest);
  }));
}

function showSyncNotice(text) {
  const notice = byId("sync-notice");
  notice.hidden = !text;
  notice.replaceChildren();
  if (text) notice.append(el("span", "", text), button("立即同步", "", refreshSession));
}

function retryTime(response) {
  const value = response.headers.get("Retry-After");
  const seconds = value && /^\d+$/.test(value) ? Number(value) : NaN;
  const until = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(value);
  return Number.isFinite(until) ? until : Date.now() + 3000;
}

function applyCooldown(until) {
  if (!until) return;
  retryAt = Math.max(retryAt, until);
  clearTimeout(cooldownTimer);
  cooldownTimer = setTimeout(syncControls, Math.max(0, retryAt - Date.now() + 1));
}

async function fetchSnapshot(path, body, signal) {
  const options = {method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal};
  if (body) {
    options.headers = {"Content-Type": "application/json"};
    if (path === "messages") options.headers.Prefer = "respond-async";
    options.body = JSON.stringify(body);
  }
  const response = await fetch("/aftercare/api/" + path, options);
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    const detail = problem.detail || problem.error;
    const error = new Error(typeof detail === "string" ? detail : "请求失败（HTTP " + response.status + "）。");
    error.status = response.status;
    if (response.status === 429 || response.status === 503) {
      error.retryTime = retryTime(response);
      const seconds = Math.max(0, Math.ceil((error.retryTime - Date.now()) / 1000));
      error.message = (response.status === 429 ? "请求频率受限。" : "服务繁忙。") + error.message + " 请在 " + seconds + " 秒后重试。";
    }
    throw error;
  }
  const next = await response.json();
  if (!Array.isArray(next.messages) || !Array.isArray(next.orders) || !Array.isArray(next.tickets)) {
    throw new Error("服务返回的数据不完整。");
  }
  return next;
}

function applySnapshot(next, force = false) {
  const previous = session;
  session = next;
  const changed = (key) => JSON.stringify(previous?.[key]) !== JSON.stringify(next[key]);
  const chatChanged = force || changed("messages") || previous?.job?.id !== next.job?.id || previous?.job?.status !== next.job?.status;
  const jobChanged = chatChanged || !previous || previous.job?.attempts !== next.job?.attempts || previous.job?.error !== next.job?.error;
  if (chatChanged) {
    const conversation = byId("conversation");
    const nearEnd = conversation.scrollHeight - conversation.clientHeight - conversation.scrollTop < 65;
    renderConversation(force || nearEnd || !previous);
  }
  if (!previous || changed("orders") || changed("proposal")) renderOrders();
  if (!previous || changed("proposal")) renderProposal();
  const finished = previous && jobInProgress(previous.job) && !jobInProgress(next.job);
  if (!previous || changed("messages") || changed("tickets") || changed("stage") || finished) renderInspector();
  if (jobChanged) renderJob();
  if (jobInProgress()) byId("stage").textContent = jobLabels[next.job.status];
  const latestReply = next.messages.findLast((message) => message.role === "assistant");
  const fallback = next.fallback_reason || latestReply?.trace?.find((entry) => entry.tool === "model_fallback")?.result?.reason;
  const mode = byId("mode");
  if (fallback) mode.textContent = "上轮回退至本地规则";
  else if (next.configured_mode === "llm" && !latestReply) mode.textContent = "云模型待调用";
  else if (next.mode === "llm") mode.textContent = "大模型模式";
  else mode.textContent = next.configured_mode === "llm" ? "上轮使用本地规则" : "本地规则模式";
  mode.parentElement.classList.toggle("is-fallback", Boolean(fallback));
  mode.parentElement.title = fallback ? fallbackText(fallback) + "可展开执行记录查看详情。" : "";
  if (previous?.job?.status !== next.job?.status) {
    byId("live-status").textContent = next.job ? "请求" + (jobLabels[next.job.status] || "已更新") : "会话已更新";
  }
  syncControls();
}

function stopSync() {
  clearTimeout(syncTimer);
  syncVersion += 1;
  readController?.abort();
  readController = null;
}

function scheduleSync(delay = 1300) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(refreshSession, Math.max(delay, retryAt - Date.now() + 1));
}

function recovered(request, next) {
  if (!request) return false;
  if (request.path === "messages") return next.job?.request_id === request.body.request_id;
  if (request.path === "confirm") return next.tickets.some((ticket) => ticket.order_id === request.orderId);
  if (request.path === "reset") return !next.job && !next.messages.length && !next.tickets.length;
  return next.job?.status === "cancelled" && request.path === "jobs/" + encodeURIComponent(next.job.id) + "/cancel";
}

async function refreshSession() {
  if (activeRequest) {
    syncAfterWrite = true;
    return;
  }
  if (Date.now() < retryAt) return scheduleSync(0);
  stopSync();
  const version = syncVersion;
  const controller = new AbortController();
  readController = controller;
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const next = await fetchSnapshot("session", null, controller.signal);
    if (version !== syncVersion) return;
    const restored = recovered(failedRequest, next);
    if (restored) {
      if (failedRequest.path === "messages" && input.value.trim() === failedRequest.body.text) input.value = "";
      failedRequest = null;
      byId("error").hidden = true;
    }
    failedReads = 0;
    showSyncNotice("");
    applySnapshot(next);
    if (jobInProgress()) scheduleSync();
  } catch (error) {
    if (version !== syncVersion) return;
    applyCooldown(error.retryTime);
    failedReads++;
    const reason = error.status ? error.message : "连接中断。";
    showSyncNotice(reason + (session ? " 当前显示上次同步结果，稍后自动重连。" : " 正在尝试重新连接。"));
    if (!session) {
      byId("mode").textContent = "连接未就绪";
      byId("conversation").replaceChildren(el("div", "loading-state", "会话暂未加载。"));
      byId("stage").textContent = "等待连接";
    }
    syncControls();
    scheduleSync(Math.min(1500 * 2 ** Math.min(failedReads - 1, 4), 15000));
  } finally {
    clearTimeout(timer);
    if (version === syncVersion) readController = null;
  }
}

async function perform(request) {
  if (activeRequest || !session || Date.now() < retryAt) return;
  if ((request.path === "messages" || request.path === "confirm") && jobInProgress()) return;
  const {path, body} = request;
  const restoreInputFocus = document.activeElement === input;
  if (path === "confirm") request.orderId ||= session.proposal?.order_id;
  stopSync();
  activeRequest = request;
  failedRequest = null;
  byId("error").hidden = true;
  showSyncNotice("");
  renderConversation(true);
  syncControls();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let resync = false;
  try {
    const next = await fetchSnapshot(path, body, controller.signal);
    activeRequest = null;
    if (path === "reset") openDetails = new Set();
    if (path === "messages" || path === "reset") input.value = "";
    applySnapshot(next, true);
    otherTabs?.postMessage("updated");
  } catch (error) {
    activeRequest = null;
    applyCooldown(error.retryTime);
    const conflict = error.status === 409 || error.status === 404;
    const text = error.name === "AbortError" ? "请求超时，正在核对服务端结果。" : error instanceof TypeError ? "连接中断，正在核对服务端结果。" : error.message;
    showError(text + (conflict ? " 已请求刷新会话。" : ""), conflict ? null : request);
    renderConversation(true);
    resync = true;
  } finally {
    clearTimeout(timer);
    syncControls();
    if (resync || syncAfterWrite) {
      syncAfterWrite = false;
      scheduleSync(0);
    }
    else if (jobInProgress()) scheduleSync();
    if (restoreInputFocus && workspace.dataset.view === "chat") input.focus({preventScroll: true});
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});
input.addEventListener("input", syncControls);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    sendMessage(input.value);
  }
});
document.querySelectorAll("[data-prompt]").forEach((control) => {
  control.addEventListener("click", () => sendMessage(control.dataset.prompt));
});
document.querySelectorAll(".mobile-nav button").forEach((control) => {
  control.addEventListener("click", () => switchView(control.dataset.view));
});
byId("reset").addEventListener("click", () => {
  byId("reset-dialog").querySelector("p").textContent = jobInProgress()
    ? "本次请求将被取消，当前会话和本次演示的工单也将被清空。"
    : "当前会话和本次演示的工单将被清空。";
  byId("reset-dialog").returnValue = "cancel";
  byId("reset-dialog").showModal();
});
byId("reset-dialog").addEventListener("close", () => {
  if (byId("reset-dialog").returnValue === "reset") {
    const request = failedRequest?.path === "reset" ? failedRequest : {path: "reset", body: {request_id: requestId()}};
    perform(request);
  }
});
otherTabs?.addEventListener("message", refreshSession);
window.addEventListener("online", refreshSession);
window.addEventListener("pageshow", (event) => { if (event.persisted) refreshSession(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshSession(); });
syncControls();
refreshSession();
