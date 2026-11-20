"""Exercise the public API's daily-turn limit using an isolated schema and a loopback model stub."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import socket
from threading import Thread
from time import monotonic, sleep
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
import uvicorn

from app import app
from eval_flow import Browser, check


class ModelStub(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        self.server.calls.append(self.path)
        message = {"role": "assistant", "content": None, "tool_calls": [
            {"id": "budget-check", "type": "function", "function": {
                "name": "finish", "arguments": json.dumps({"action": "answer", "text": "额度测试响应"})}},
        ]}
        data = json.dumps({"choices": [{"message": message}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_args):
        pass


@contextmanager
def isolated_service():
    database = os.environ["AFTERCARE_DATABASE_URL"]
    schema = "aftercare_test_" + uuid4().hex
    settings = {key: os.environ.get(key) for key in
                ("AFTERCARE_DATABASE_URL", "AFTERCARE_LLM_API_KEY", "AFTERCARE_LLM_MODEL",
                 "AFTERCARE_LLM_BASE_URL", "AFTERCARE_LLM_DAILY_TURNS")}
    with psycopg.connect(database, autocommit=True) as admin, ThreadingHTTPServer(("127.0.0.1", 0), ModelStub) as model:
        # This schema only belongs to this test run; never use or reset the site's quota table.
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        model.calls = []
        model_thread = Thread(target=model.serve_forever, daemon=True)
        model_thread.start()
        try:
            os.environ.update(AFTERCARE_DATABASE_URL=make_conninfo(database, options="-csearch_path=" + schema),
                              AFTERCARE_LLM_BASE_URL=f"http://127.0.0.1:{model.server_port}/v1",
                              AFTERCARE_LLM_API_KEY="local-test", AFTERCARE_LLM_MODEL="local-stub",
                              AFTERCARE_LLM_DAILY_TURNS="1")
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                port = listener.getsockname()[1]
                server = uvicorn.Server(uvicorn.Config(app, log_level="error", access_log=False))
                worker = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
                worker.start()
                try:
                    deadline = monotonic() + 10
                    while not server.started and worker.is_alive() and monotonic() < deadline:
                        sleep(0.03)
                    check(server.started, "isolated test service failed to start")
                    yield f"http://127.0.0.1:{port}/aftercare", model
                finally:
                    server.should_exit = True
                    worker.join(10)
        finally:
            model.shutdown()
            model_thread.join()
            for key, value in settings.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            admin.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


def run():
    with isolated_service() as (url, model):
        users = [Browser(url) for _ in range(5)]
        for user in users:
            initial = user.call("session")
            check(initial["mode"] == initial["configured_mode"] == "llm", "initial provider state")
        with ThreadPoolExecutor(max_workers=len(users)) as pool:
            replies = list(pool.map(lambda u: u.say("你好", "hello"), users))
        check(len(model.calls) == 1 and sum(r["mode"] == "llm" for r in replies) == 1, "daily limit overrun")
        for user, reply in zip(users, replies):
            check(reply["configured_mode"] == "llm", "fallback masked the configured provider")
            if reply["mode"] == "offline":
                check(reply["fallback_reason"] == "daily_turn_limit", "fallback omitted the budget reason")
            check(user.say("你好", "hello")["messages"] == reply["messages"], "duplicate request was re-run")
            check(user.call("session")["mode"] == reply["mode"], "refresh lost last reply mode")

        # Removing the key switches a fresh browser to rules and does not reserve another turn.
        os.environ["AFTERCARE_LLM_API_KEY"] = ""
        free = Browser(url)
        check(free.call("session")["configured_mode"] == "offline", "empty key must stay usable")
        result = free.say("查询换货政策")
        check(result["mode"] == "offline" and not result.get("fallback_reason"), "offline mode needs no quota")
        with psycopg.connect(os.environ["AFTERCARE_DATABASE_URL"]) as conn:
            turns = conn.execute("SELECT sum(turns) FROM aftercare_llm_daily").fetchone()[0]
        check(turns == 1 and len(model.calls) == 1, "quota or mock traffic disagrees with actual requests")
    return {"parallel_sessions": 5, "limit": 1, "mock_model_turns": 1, "offline_fallbacks": 4,
            "duplicate_calls": 0, "unconfigured_mode": "offline"}


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
