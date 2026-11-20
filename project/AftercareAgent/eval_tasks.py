"""Run the queue integration tests inside the container against disposable local servers."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
import socket
import subprocess
import sys
from threading import Condition, Event, Thread
from time import monotonic, sleep
from urllib.error import URLError
from urllib.request import urlopen
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

from eval_flow import Browser, check, quantities, run as business_regression


def eventually(read, predicate, timeout=18):
    deadline = monotonic() + timeout
    while monotonic() < deadline:
        value = read()
        if predicate(value):
            return value
        sleep(0.08)
    raise AssertionError("Timed out waiting for the expected state")


def fn(call_id, name, **args):
    return {"id": call_id, "type": "function", "function": {
        "name": name, "arguments": json.dumps(args, ensure_ascii=False)}}


class FakeModel(BaseHTTPRequestHandler):
    """Use real HTTP tool calls; only the model and its latency are simulated."""

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        messages = data["messages"]
        text = next(m["content"] for m in reversed(messages) if m["role"] == "user")
        last_role = messages[-1]["role"]
        with self.server.changed:
            self.server.inflight += 1
            self.server.peak = max(self.server.peak, self.server.inflight)
            self.server.texts.append(text)
            self.server.changed.notify_all()
        try:
            if last_role == "user":
                if "慢响应" in text:
                    sleep(10)
                if "吞吐" in text:
                    sleep(0.3)
                if "占位" in text or ("恢复" in text and self.server.texts.count(text) == 1):
                    self.server.release.wait(18)
            if "AC-1001" in text and last_role == "user":
                ref = {"order_id": "AC-1001"}
                calls = [fn("a", "get_order", **ref), fn("b", "get_inventory", **ref),
                         fn("c", "search_policy", query="签收后多少天可申请换货", **ref)]
            elif "AC-1001" in text:
                calls = [fn("d", "finish", action="exchange", order_id="AC-1001",
                            policy_ids=["EX-2026-02"], text="请确认换货。")]
            else:
                calls = [fn("e", "finish", action="answer", text="本地测试响应")]
            body = json.dumps({"choices": [{"message": {"role": "assistant", "content": None,
                               "tool_calls": calls}}], "usage": {"prompt_tokens": 20, "completion_tokens": 5}}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # The recovery scenario terminates its own client process.
        finally:
            with self.server.changed:
                self.server.inflight -= 1
                self.server.changed.notify_all()

    def log_message(self, *_args):
        pass


class Service:
    def __init__(self, settings):
        self.settings = settings
        self.proc = None

    def start(self):
        # Pass the listening socket to Uvicorn to avoid a race for a free port.
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
            self.base = f"http://127.0.0.1:{port}/aftercare"
            self.proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app:app", "--fd",
                                          str(listener.fileno()), "--log-level", "error"],
                                         pass_fds=(listener.fileno(),), env=self.settings)
        def ready():
            if self.proc.poll() is not None:
                raise RuntimeError("Test service exited during startup")
            try:
                with urlopen(self.base + "/health", timeout=1) as response:
                    return response.status == 200
            except (OSError, URLError):
                return False
        eventually(ready, bool)
        return self

    def stop(self, crash=False):
        if self.proc and self.proc.poll() is None:
            if crash:
                self.proc.kill()
            else:
                self.proc.terminate()
            try:
                self.proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()


@contextmanager
def fixture(**overrides):
    schema = "aftercare_eval_" + uuid4().hex
    db = os.environ["AFTERCARE_DATABASE_URL"]
    scoped_db = make_conninfo(db, options="-csearch_path=" + schema)
    with psycopg.connect(db, autocommit=True) as admin, ThreadingHTTPServer(("127.0.0.1", 0), FakeModel) as model:
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        model.changed = Condition()
        model.release = Event()
        model.inflight, model.peak, model.texts = 0, 0, []
        thread = Thread(target=model.serve_forever, daemon=True)
        thread.start()
        settings = dict(os.environ, AFTERCARE_DATABASE_URL=scoped_db, PGAPPNAME=schema,
                        AFTERCARE_LLM_BASE_URL=f"http://127.0.0.1:{model.server_port}/v1",
                        AFTERCARE_LLM_MODEL="local-stub", AFTERCARE_LLM_API_KEY="local-stub",
                        AFTERCARE_MAX_RUNNING="2", AFTERCARE_WORKER_THREADS="2",
                        AFTERCARE_QUEUE_LIMIT="5", AFTERCARE_SESSION_TURNS_PER_MINUTE="2",
                        AFTERCARE_JOB_LEASE_SECONDS="4", AFTERCARE_JOB_MAX_ATTEMPTS="2",
                        AFTERCARE_LLM_DAILY_TURNS="100")
        settings.update(overrides)
        services = []
        def launch():
            service = Service(settings)
            services.append(service)
            return service.start()
        try:
            yield launch, model, scoped_db
        finally:
            model.release.set()
            for service in services:
                service.stop()
            model.shutdown()
            thread.join()
            admin.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def visitor(server):
    browser = Browser(server.base)
    browser.call("session")
    return browser


def post(browser, text, key=None, status=(200, 202)):
    return browser.call("messages", {"text": text, "request_id": key or uuid4().hex},
                        status, headers={"Prefer": "respond-async"})


def cancel(browser, job, key=None, status=200):
    return browser.call(f"jobs/{job}/cancel", {"request_id": key or uuid4().hex}, status)


def wait_for_job(browser, job, target, timeout=18):
    return eventually(lambda: browser.call(f"jobs/{job}"),
                      lambda view: view["job"]["status"] == target, timeout)


def waiting_transactions(db):
    with psycopg.connect(db) as conn:
        return conn.execute("""
            SELECT count(DISTINCT a.pid) FROM pg_stat_activity a JOIN pg_locks l USING(pid)
            JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE a.state='idle in transaction' AND n.nspname=current_schema()
              AND a.pid <> pg_backend_pid()
        """).fetchone()[0]


def slow_cancel():
    with fixture() as (launch, model, db):
        server = launch()
        user = visitor(server)
        text = "请给 AC-1001 换货，慢响应"
        t = monotonic()
        job = post(user, text, "slow")["job"]["id"]
        submit_ms = round((monotonic()-t)*1000, 1)
        eventually(lambda: model.inflight, lambda n: n > 0)
        waits = []
        for _ in range(20):
            t = monotonic()
            check(user.call("session")["job"]["id"] == job, "reload did not find active job")
            waits.append((monotonic()-t)*1000)
        held = waiting_transactions(db)
        check(held == 0, "model wait held a database transaction")
        check(max(waits) < 3000 and submit_ms < 3000, "server waited for the ten-second model")
        check(post(user, text, "slow")["job"]["id"] == job, "duplicate message changed job")
        post(user, "同一会话的新请求", status=409)
        other = visitor(server)
        other.call(f"jobs/{job}", status=404)
        cancel(other, job, status=404)
        t = monotonic()
        result = cancel(user, job)
        cancel_ms = round((monotonic()-t)*1000, 1)
        check(result["job"]["status"] == "cancelled" and cancel_ms < 3000, "cancellation blocked")
        eventually(lambda: model.inflight, lambda n: n == 0)
        # Submit a later turn and keep polling for any stale draft from the cancelled exchange.
        new_job = post(user, "新的请求")["job"]["id"]
        final = wait_for_job(user, new_job, "completed")
        check(not final["proposal"] and not final["tickets"], "late result recreated a draft")
        check(wait_for_job(user, job, "cancelled")["proposal"] is None, "cancelled result applied")
        with psycopg.connect(db, autocommit=True) as conn:
            eventually(lambda: conn.execute("SELECT lease_token FROM aftercare_jobs WHERE id=%s",
                                            (job,)).fetchone()[0], lambda token: token is None)
        check(model.texts.count(text) == 1, "cancelled turn made a second model call")
        return {"model_delay_seconds": 10, "submit_ms": submit_ms, "refresh_samples": len(waits),
                "refresh_p95_ms": round(sorted(waits)[math.ceil(.95*len(waits))-1], 1),
                "cancel_ms": cancel_ms, "idle_transactions_holding_fixture_tables": held}


def capacity():
    with fixture() as (launch, model, _db):
        servers = [launch(), launch()]
        users = [visitor(servers[i % 2]) for i in range(8)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda u: post(u, "占位"), users[:2]))
        eventually(lambda: model.inflight, lambda n: n == 2)
        queued = [post(u, "排队")["job"]["id"] for u in users[2:5]]
        check(all(u.call("session")["job"]["status"] == "queued" for u in users[2:5]), "queue state")
        post(users[5], "排队已满", status=503)
        check(int(users[5].last_headers["Retry-After"]) > 0, "missing queue retry interval")
        cancel(users[2], queued[0])
        reset_key = {"request_id": "reset-from-other-tab"}
        users[3].call("reset", reset_key)
        wait_for_job(users[3], queued[1], "cancelled")
        replacement = post(users[3], "重置后新任务")["job"]["id"]
        check(users[3].call("reset", reset_key)["job"]["id"] == replacement, "replayed reset cleared new job")
        model.release.set()
        wait_for_job(users[3], replacement, "completed")
        wait_for_job(users[4], queued[2], "completed")
        check(model.peak == 2, "model concurrency exceeded the shared limit")
        user = users[0]
        first = user.call("session")["job"]["id"]
        wait_for_job(user, first, "completed")
        second = post(user, "第二条", "second")["job"]["id"]
        wait_for_job(user, second, "completed")
        check(post(user, "第二条", "second")["job"]["id"] == second, "retry counted toward rate")
        post(user, "第三条", status=429)
        check(int(user.last_headers["Retry-After"]) > 0, "missing session retry interval")
        return {"service_processes": 2, "max_running_observed": model.peak, "queue_full_http": 503,
                "session_limit_http": 429}


def recover(*, after_response=False):
    with fixture() as (launch, model, db):
        first_server = launch()
        user = visitor(first_server)
        initial = user.call("session")
        text = "恢复：请给 AC-1001 换货"
        target = post(user, text, "recover")["job"]["id"]
        eventually(lambda: model.inflight, lambda n: n > 0)
        if after_response:
            # Delay only this private session's final DB write. Both mock HTTP responses
            # have already returned when the application reaches its completion lock.
            with psycopg.connect(db) as blocker, psycopg.connect(db, autocommit=True) as observer:
                blocker.execute("""SELECT id FROM aftercare_sessions WHERE id=(
                    SELECT session_id FROM aftercare_jobs WHERE id=%s) FOR UPDATE""", (target,))
                model.release.set()
                eventually(lambda: observer.execute("""SELECT EXISTS (SELECT 1 FROM pg_stat_activity
                    WHERE application_name=current_schema() AND wait_event_type='Lock'
                      AND query LIKE 'SELECT state,generation,revision FROM aftercare_sessions%')""").fetchone()[0], bool)
                first_server.stop(crash=True)
        else:
            first_server.stop(crash=True)
        model.release.set()
        user.base = launch().base
        result = wait_for_job(user, target, "completed", timeout=30)
        check(result["job"]["attempts"] == 2 and result["proposal"]["order_id"] == "AC-1001", "recovery")
        check(result["mode"] == "offline" and result["fallback_reason"] == "interrupted_model_turn",
              "interrupted turn should use the local recovery policy")
        check(model.texts.count(text) == (2 if after_response else 1),
              "recovery resubmitted a possibly billed request")
        check(sum(m["role"] == "user" and m["text"] == text for m in result["messages"]) == 1, "duplicate input")
        check(post(user, text, "recover")["job"]["id"] == target, "recovery lost request id")
        with psycopg.connect(db) as conn:
            turns = conn.execute("SELECT sum(turns) FROM aftercare_llm_daily").fetchone()[0]
        check(turns == 1, "retry consumed another daily turn")
        draft = result["proposal"]["id"]
        user.confirm(draft)
        final = user.confirm(draft)
        check(len(final["tickets"]) == 1 and quantities(initial)["AC-1001"]-quantities(final)["AC-1001"] == 1,
              "recovered task duplicated inventory mutation")
        return {"attempts": result["job"]["attempts"], "daily_turns": int(turns),
                "provider_calls": model.texts.count(text), "tickets": len(final["tickets"])}


def throughput():
    with fixture(AFTERCARE_QUEUE_LIMIT="20") as (launch, model, db):
        servers = [launch(), launch()]
        users = [visitor(servers[i % 2]) for i in range(12)]
        def complete(item):
            index, user = item
            start = monotonic()
            job = post(user, f"吞吐测试 {index}")["job"]["id"]
            view = wait_for_job(user, job, "completed")
            check(view["mode"] == "llm", "load test should use the simulated provider")
            return (monotonic() - start) * 1000

        with psycopg.connect(db, autocommit=True) as monitor, ThreadPoolExecutor(max_workers=len(users)) as pool:
            pending = [pool.submit(complete, pair) for pair in enumerate(users)]
            peak_db = 0
            while not all(f.done() for f in pending):
                count = monitor.execute("""SELECT count(*) FROM pg_stat_activity
                    WHERE application_name=current_schema() AND datname=current_database()""").fetchone()[0]
                peak_db = max(peak_db, count)
                sleep(0.02)
            elapsed = sorted(f.result() for f in pending)
        check(peak_db > 0 and model.peak == 2, "load test did not observe both services")
        return {"sessions": len(users), "completed": len(elapsed), "simulated_call_ms": 300,
                "completion_p95_ms": round(elapsed[math.ceil(.95*len(elapsed))-1], 1),
                "sampled_peak_db_connections": peak_db, "peak_simultaneous_model_calls": model.peak}


if __name__ == "__main__":
    print(json.dumps({"slow_model": slow_cancel(), "backpressure": capacity(), "restart": recover(),
                      "restart_after_response": recover(after_response=True),
                      "concurrent_sessions": throughput()}, indent=2), flush=True)
    with fixture(AFTERCARE_LLM_API_KEY="", AFTERCARE_SESSION_TURNS_PER_MINUTE="30") as (launch, _, _db):
        report = business_regression(launch().base)
        print(f"Original business regression (isolated, offline): {report['passed']} passed")
