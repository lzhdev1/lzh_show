import asyncio
from contextlib import asynccontextmanager
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import Cookie, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

import agent
import store
import worker
from catalog import citations


@asynccontextmanager
async def lifespan(_app):
    await run_in_threadpool(store.initialize)
    manager = worker.start_workers(snapshot=snapshot, apply_plan=apply_plan)
    _app.state.workers = manager
    try:
        yield
    finally:
        await run_in_threadpool(worker.stop_workers, manager)


app = FastAPI(title="售后换货工作台", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
static_dir = Path(__file__).parent / "static"
app.mount("/aftercare/assets", StaticFiles(directory=static_dir), name="assets")
COOKIE = "aftercare_session"
ACTIVE = {"queued", "running"}
LEGACY_WAIT_SECONDS = 40


class Message(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    request_id: str = Field(min_length=1, max_length=128)


class RequestID(BaseModel):
    request_id: str = Field(min_length=1, max_length=128)


class ResetRequest(BaseModel):
    request_id: str | None = Field(default=None, min_length=1, max_length=128)


class Confirmation(RequestID):
    proposal_id: str = Field(min_length=1, max_length=128)


@app.get("/aftercare")
@app.get("/aftercare/")
def home():
    return FileResponse(static_dir / "index.html")


@app.get("/aftercare/health")
def health():
    with store.connect() as conn:
        conn.execute("SELECT 1 FROM aftercare_sessions LIMIT 1")
    return {"status": "ok"}


def mark_private(request, response, sid):
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(COOKIE, str(sid), path="/aftercare", max_age=7 * 86400,
                        httponly=True, samesite="lax", secure=request.url.scheme == "https")


def snapshot(conn, sid, state):
    view = store.snapshot(conn, sid, state)
    view["configured_mode"] = agent.configured_mode()
    if not view["messages"]:
        view["mode"] = view["configured_mode"]
    return view


def read_snapshot(conn, sid, job_id=None):
    # A worker publishes its decision and terminal job atomically. Read all parts
    # of that same version without blocking the worker or writing on every poll.
    conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
    state = store.read_state(conn, sid)
    if state is None:
        return None
    job = store.latest_job(conn, sid) if job_id is None else store.job_for_session(conn, sid, job_id)
    if job_id is not None and job is None:
        raise HTTPException(404, "任务不存在或不属于本会话。")
    return {**snapshot(conn, sid, state), "job": job}


@app.get("/aftercare/api/session")
def session(request: Request, response: Response, cookie: str | None = Cookie(None, alias=COOKIE)):
    with store.connect() as conn:
        sid = store.session_id(cookie)
        if sid:
            store.touch_if_stale(conn, sid)
            conn.commit()
            view = read_snapshot(conn, sid)
            if view is not None:
                mark_private(request, response, sid)
                return view
            conn.rollback()
        sid, state = store.create_session(conn)
        mark_private(request, response, sid)
        return {**snapshot(conn, sid, state), "job": None}


def current(conn, cookie):
    sid = store.session_id(cookie)
    state = store.load(conn, sid)
    if state is None:
        raise HTTPException(409, "演示会话已过期，请刷新页面。")
    return sid, state


def new_request(conn, sid, request_id, action, value):
    signature = sha256((action + "\n" + value).encode("utf-8")).hexdigest()
    try:
        return store.record_request(conn, sid, request_id, signature)
    except ValueError as err:
        raise HTTPException(409, str(err)) from err


def clear_proposal(state):
    state.update(proposal=None, pending_exchange=False, stage="idle")


def reply(state, text, references=(), tools=(), trace=()):
    state["messages"].append({"role": "assistant", "text": text, "citations": citations(references),
                              "tools": list(dict.fromkeys(tools)), "trace": list(trace)})
    # Bound conversation history without discarding pending proposals or durable tickets.
    state["messages"] = state["messages"][-80:]


def apply_plan(state, view, decision):
    action = decision.get("action", "answer")
    order = next((o for o in view["orders"] if o["id"] == decision.get("order_id")), None)
    text = decision.get("text") or ""
    references = decision.get("policy_ids") or []
    tools = list(decision.get("tools") or [])
    trace = list(decision.get("trace") or [])
    state["mode"] = decision.get("mode", "offline")
    state["fallback_reason"] = next((t["result"].get("reason") for t in reversed(trace)
                                     if t["tool"] == "model_fallback"), None)
    if order and not state["proposal"]:
        state["selected_order_id"] = order["id"]
    if action == "exchange" and order:
        old_proposal = state.get("proposal")
        clear_proposal(state)
        state["selected_order_id"] = order["id"]
        references = [order["policy_id"], order["reason_id"]]
        if order["eligible"]:
            name = f"{order['name']} · {order['variant']}"
            proposal = (old_proposal if old_proposal and old_proposal["order_id"] == order["id"] else
                        {"id": uuid4().hex, "order_id": order["id"], "name": name})
            state.update(stage="awaiting_confirmation", proposal=proposal)
            references += ["AC-STOCK", "AC-CONFIRM"]
            text = f"订单 {order['id']}（{name}）可换货。{order['reason']} 请核对下方草稿，确认后将创建换货工单。"
        else:
            text = f"订单 {order['id']} 当前无法申请换货。{order['reason']}"
    elif action in ("clarify", "exchange"):
        clear_proposal(state)
        state.update(stage="clarifying", pending_exchange=True, selected_order_id=None)
        text = text or "请提供需要换货的订单编号或商品颜色。"
    elif action == "cancel":
        clear_proposal(state)
        state["selected_order_id"] = None
        text = "已关闭本次换货申请。已有工单可在工单记录中查看。"
    elif action == "status":
        tickets = view["tickets"]
        if order:
            tickets = [t for t in tickets if t["order_id"] == order["id"]]
        text = ("已创建的换货工单：" + "；".join(f"{t['id']}（{t['order_id']}，{t['name']}）" for t in tickets)
                if tickets else "当前没有对应的换货工单。")
    elif action == "list_orders" and not text:
        text = "\n".join(f"{o['id']} · {o['name']} · {o['variant']}" for o in view["orders"])
    reply(state, text or "请描述售后问题，或提供订单编号以查询换货条件。", references, tools, trace)


@app.exception_handler(store.JobConflict)
@app.exception_handler(store.JobLimit)
@app.exception_handler(store.QueueFull)
async def job_error(_request: Request, exc):
    if isinstance(exc, store.QueueFull):
        status, retry = 503, 2
    elif isinstance(exc, store.JobLimit):
        status, retry = 429, 60
    else:
        status, retry = 409, None
    headers = {"Cache-Control": "no-store"}
    if retry is not None:
        headers["Retry-After"] = str(getattr(exc, "retry_after", retry))
    return JSONResponse(status_code=status, content={"detail": str(exc)}, headers=headers)


def submit_message(cookie, request_id, text):
    with store.connect() as conn:
        sid, state = current(conn, cookie)
        job, created = store.enqueue(conn, sid, request_id, text)
        return sid, {**snapshot(conn, sid, state), "job": job}, created


def job_snapshot(cookie, job_id):
    with store.connect() as conn:
        sid = store.session_id(cookie)
        view = read_snapshot(conn, sid, job_id) if sid else None
        if view is None:
            raise HTTPException(409, "演示会话已过期，请刷新页面。")
        return sid, view


def job_has_finished(sid, job_id):
    with store.connect() as conn:
        job = store.job_for_session(conn, sid, job_id)
        return job is None or job["status"] not in ACTIVE


async def wait_legacy(sid, job_id):
    # Waiting clients hold neither a DB transaction nor an application worker thread.
    loop = asyncio.get_running_loop()
    deadline = loop.time() + LEGACY_WAIT_SECONDS
    delay = 0.1
    while (remaining := deadline - loop.time()) > 0:
        await asyncio.sleep(min(delay, remaining))
        if await run_in_threadpool(job_has_finished, sid, job_id):
            break
        delay = min(1.0, delay * 2)
    _, view = await run_in_threadpool(job_snapshot, str(sid), job_id)
    return view


@app.post("/aftercare/api/messages")
async def message(body: Message, request: Request, response: Response,
                  cookie: str | None = Cookie(None, alias=COOKIE)):
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "消息不能为空。")
    sid, view, created = await run_in_threadpool(submit_message, cookie, body.request_id, text)
    if created:
        request.app.state.workers.wake()

    job = view["job"]
    preferences = {p.strip().lower() for p in request.headers.get("prefer", "").split(",")}
    if "respond-async" in preferences:
        response.headers["Preference-Applied"] = "respond-async"
    elif job and job["status"] in ACTIVE:
        view = await wait_legacy(sid, job["id"])
        job = view["job"]
    if job:
        response.headers["Location"] = f"/aftercare/api/jobs/{job['id']}"
        if job["status"] in ACTIVE:
            response.status_code = 202
    mark_private(request, response, sid)
    return view


@app.get("/aftercare/api/jobs/{job_id}")
def get_job(job_id: UUID, request: Request, response: Response, cookie: str | None = Cookie(None, alias=COOKIE)):
    sid, view = job_snapshot(cookie, job_id)
    mark_private(request, response, sid)
    return view


@app.post("/aftercare/api/jobs/{job_id}/cancel")
def cancel_job(job_id: UUID, body: RequestID, request: Request, response: Response,
               cookie: str | None = Cookie(None, alias=COOKIE)):
    with store.connect() as conn:
        sid, state = current(conn, cookie)
        job = store.cancel_job(conn, sid, job_id, body.request_id)
        if job is None:
            raise HTTPException(404, "任务不存在或不属于本会话。")
        mark_private(request, response, sid)
        return {**snapshot(conn, sid, state), "job": job}


@app.post("/aftercare/api/confirm")
def confirm(body: Confirmation, request: Request, response: Response,
            cookie: str | None = Cookie(None, alias=COOKIE)):
    with store.connect() as conn:
        sid, state = current(conn, cookie)
        if (new_request(conn, sid, body.request_id, "confirm", body.proposal_id)
                and not store.ticket_for_proposal(conn, sid, body.proposal_id)):
            if store.active_job(conn, sid):
                raise HTTPException(409, "当前有任务正在处理，请等待或取消任务后再确认草稿。")
            proposal = state["proposal"]
            if not proposal or proposal["id"] != body.proposal_id:
                raise HTTPException(409, "这份草稿已失效，请核对当前草稿。")
            view = store.snapshot(conn, sid, state)
            order = next(o for o in view["orders"] if o["id"] == proposal["order_id"])
            trace = [{"tool": "check_eligibility", "args": {"order_id": order["id"]},
                      "result": {"eligible": order["eligible"], "reason": order["reason"]}}]
            if order["eligible"]:
                ticket_id = store.add_ticket(conn, sid, proposal)
                trace.append({"tool": "create_ticket", "args": {"order_id": order["id"]},
                              "result": {"ticket_id": ticket_id}})
                text = f"换货工单 {ticket_id} 已创建。关联订单 {order['id']}，换货商品为{proposal['name']}。"
            else:
                text = f"重新核验后无法创建工单。{order['reason']}"
            clear_proposal(state)
            reply(state, text, [order["policy_id"], order["reason_id"], "AC-CONFIRM"],
                  [t["tool"] for t in trace], trace)
            store.save(conn, sid, state)
        mark_private(request, response, sid)
        return {**snapshot(conn, sid, state), "job": store.latest_job(conn, sid)}


@app.post("/aftercare/api/reset")
def reset(request: Request, response: Response, body: ResetRequest | None = None,
          cookie: str | None = Cookie(None, alias=COOKIE)):
    with store.connect() as conn:
        sid, state = current(conn, cookie)
        if not body or not body.request_id or new_request(conn, sid, body.request_id, "reset", ""):
            state = store.reset(conn, sid)
        mark_private(request, response, sid)
        return {**snapshot(conn, sid, state), "job": store.latest_job(conn, sid)}
