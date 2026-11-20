"""Run with python -m unittest test_agent. Every HTTP call here stays on loopback."""

import json
import os
import threading
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import agent
from catalog import ORDERS, POLICIES, assess
from eval_agent import evaluate


CONTEXT = {"orders": [assess(o, o["stock"]) for o in ORDERS], "policies": POLICIES}


def tool_call(call_id, name, kwargs):
    return {"id": call_id, "type": "function", "function": {"name": name, "arguments": json.dumps(kwargs)}}


@contextmanager
def provider(responses, *, usage=None, status=503):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            msg = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests.append((self.path, self.headers["Authorization"], msg))
            if len(requests) > len(responses):
                self.send_error(status)
                return
            answer = {"choices": [{"message": {"role": "assistant", "content": None,
                                  "tool_calls": responses[len(requests) - 1]}}]}
            if usage is not None:
                answer["usage"] = usage
            body = json.dumps(answer).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.01), daemon=True)
    thread.start()
    config = {"AFTERCARE_LLM_BASE_URL": f"http://127.0.0.1:{server.server_port}/compatible-mode/v1",
              "AFTERCARE_LLM_API_KEY": "unit-test-only", "AFTERCARE_LLM_MODEL": "mock-qwen"}
    try:
        with patch.dict(os.environ, config):
            yield requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(2)


class AgentTests(unittest.TestCase):
    def test_real_http_tool_roundtrip(self):
        oid = {"order_id": "AC-1001"}
        responses = [
            [tool_call("t1", "list_orders", {"query": "AC-1001"})],
            [tool_call("t2", "get_order", oid), tool_call("t3", "search_policy", {**oid, "query": "换货期限"}),
             tool_call("t4", "get_inventory", oid)],
            [tool_call("t5", "finish", {**oid, "action": "exchange", "text": "请核对换货草稿。", "policy_ids": ["EX-2026-02"]})],
        ]
        with provider(responses, usage={"prompt_tokens": 82, "completion_tokens": 19}) as requests:
            result = agent.plan("请给 AC-1001 换货", {}, CONTEXT)
        self.assertEqual(result["mode"], "llm")
        self.assertEqual(result["action"], "exchange")
        self.assertEqual(result["order_id"], "AC-1001")
        self.assertEqual(result["tools"], ["list_orders", "get_order", "search_policy", "get_inventory", "model_usage"])
        self.assertEqual(result["trace"][-2]["result"]["stock"], 3)
        usage = result["trace"][-1]["result"]
        self.assertEqual(usage["calls"], 3)
        self.assertEqual(usage["prompt_tokens"], 246)
        self.assertEqual(usage["completion_tokens"], 57)
        self.assertGreater(usage["elapsed_ms"], 0)
        self.assertEqual(len(requests), 3)
        path, header, payload = requests[-1]
        self.assertEqual(path, "/compatible-mode/v1/chat/completions")
        self.assertEqual(header, "Bearer unit-test-only")
        self.assertEqual(payload["model"], "mock-qwen")
        replies = {m["tool_call_id"]: json.loads(m["content"]) for m in payload["messages"] if m["role"] == "tool"}
        self.assertEqual(set(replies), {"t1", "t2", "t3", "t4"})
        self.assertEqual(replies["t3"]["as_of"], "2026-11-15")
        self.assertEqual(replies["t4"]["stock"], 3)
        self.assertNotIn("create_ticket", [t["function"]["name"] for t in payload["tools"]])

    def test_rejects_unfetched_citations(self):
        with provider([[tool_call("t1", "finish", {"action": "policy", "text": "不正确", "policy_ids": ["FAKE"]})]]):
            result = agent.plan("旧版规则是什么", {}, CONTEXT)
        self.assertEqual(result["mode"], "offline")
        self.assertEqual(result["policy_ids"], ["EX-2026-01"])
        self.assertIn("model_fallback", result["tools"])
        self.assertIsNone(result["trace"][-1]["result"]["prompt_tokens"])

    def test_exchange_with_order_and_stock_reuses_both_and_checks_only_the_missing_policy(self):
        for oid, ordered, expected in [("AC-1001", "2026-11-15", "EX-2026-02"), ("AC-1003", "2026-10-30", "EX-2026-01")]:
            with self.subTest(oid=oid):
                args = {"order_id": oid}
                responses = [
                    [tool_call("order", "get_order", args), tool_call("stock", "get_inventory", args)],
                    [tool_call("done", "finish", {**args, "action": "exchange", "text": "请核对。", "policy_ids": [expected]})],
                ]
                with provider(responses) as requests:
                    result = agent.plan(f"帮我给 {oid} 换货", {}, CONTEXT)
                self.assertEqual(result["mode"], "llm")
                self.assertEqual(result["action"], "exchange")
                self.assertEqual(result["policy_ids"], [expected])
                self.assertEqual(result["tools"], ["get_order", "get_inventory", "search_policy", "model_usage"])
                self.assertEqual(len(requests), 2)
                self.assertEqual(result["trace"][-1]["result"]["calls"], 2)
                checks = [s for s in result["trace"] if s.get("source") == "server_check"]
                self.assertEqual([s["tool"] for s in checks], ["search_policy"])
                self.assertEqual(checks[0]["result"]["as_of"], ordered)
                self.assertIn(expected, [p["id"] for p in checks[0]["result"]["clauses"]])

    def test_exchange_cannot_cite_a_different_orders_policy(self):
        args = {"order_id": "AC-1003"}
        responses = [
            [tool_call("wrong", "search_policy", {"order_id": "AC-1001", "query": "签收换货期限"}),
             tool_call("order", "get_order", args)],
            [tool_call("done", "finish", {**args, "action": "exchange", "text": "随便引一个。", "policy_ids": ["EX-2026-02"]})],
        ]
        with provider(responses) as requests:
            result = agent.plan("帮我给 AC-1003 换货", {}, CONTEXT)
        self.assertEqual(result["mode"], "offline")
        self.assertEqual(result["policy_ids"], ["EX-2026-01"])
        self.assertEqual([s["result"]["reason"] for s in result["trace"] if s["tool"] == "model_fallback"], ["unsupported_citation"])
        self.assertEqual(result["tools"].count("get_order"), 1)
        self.assertEqual(result["tools"].count("get_inventory"), 1)
        self.assertEqual(len(requests), 2)

    def test_missing_applicable_policy_falls_back_without_an_exchange_proposal(self):
        args = {"order_id": "AC-1001"}
        responses = [
            [tool_call("inventory", "get_inventory", args)],
            [tool_call("done", "finish", {**args, "action": "exchange", "text": "请核对。"})],
        ]
        incomplete = {**CONTEXT, "policies": [p for p in POLICIES if p["id"] != "EX-2026-02"]}
        with provider(responses):
            result = agent.plan("AC-1001 帮我换货", {}, incomplete)
        self.assertEqual(result["action"], "answer")
        self.assertEqual(result["mode"], "offline")
        self.assertEqual(result["policy_ids"], [])
        self.assertEqual(result["tools"].count("get_order"), 1)
        self.assertEqual(result["tools"].count("get_inventory"), 1)
        self.assertEqual(result["tools"].count("search_policy"), 1)
        self.assertEqual([s["result"]["reason"] for s in result["trace"] if s["tool"] == "model_fallback"], ["missing_exchange_evidence"])

    def test_rejects_model_guessing_an_ambiguous_order(self):
        with provider([[tool_call("t1", "finish", {"action": "exchange", "order_id": "AC-1001", "text": "待核对"})]]):
            result = agent.plan("耳机坏了帮我换", {}, CONTEXT)
        self.assertEqual(result["action"], "clarify")
        self.assertNotIn("order_id", result)
        self.assertEqual(result["mode"], "offline")

    def test_configured_service_failure_uses_labelled_offline_mode(self):
        for code in (401, 403, 429):
            with self.subTest(code=code), provider([], status=code):
                result = agent.plan("耳机坏了帮我换", {}, CONTEXT)
                self.assertEqual(result["mode"], "offline")
                self.assertEqual(result["trace"][0]["result"]["reason"], f"http_{code}")
                self.assertNotIn("unit-test-only", json.dumps(result))
        with provider([]), patch.object(agent, "_chat", side_effect=TimeoutError):
            result = agent.plan("耳机坏了帮我换", {}, CONTEXT)
            self.assertEqual(result["trace"][0]["result"]["reason"], "timeout")

    def test_quota_forces_offline_without_network(self):
        with provider([]) as requests:
            self.assertEqual(agent.configured_mode(), "llm")
            result = agent.plan("换耳机", {}, CONTEXT, offline_reason="daily_turn_limit")
            self.assertEqual(requests, [])
            self.assertEqual(result["mode"], "offline")
            self.assertEqual(result["trace"][0]["result"]["reason"], "daily_turn_limit")

    def test_cancel_between_tool_rounds_prevents_another_model_call(self):
        responses = [
            [tool_call("t1", "list_orders", {})],
            [tool_call("t2", "finish", {"action": "list_orders", "text": "查询结果"})],
        ]
        with provider(responses) as requests, patch.object(agent, "offline") as fallback:
            # Simulate a cancellation committed after the first provider request.
            with self.assertRaises(agent.PlanInterrupted):
                agent.plan("列出我的订单", {}, CONTEXT, should_continue=lambda: not requests)
            self.assertEqual(len(requests), 1)
            fallback.assert_not_called()

    def test_empty_key_uses_no_http_and_multiorder_policy_stays_read_only(self):
        with patch.dict(os.environ, {"AFTERCARE_LLM_BASE_URL": "https://example.invalid/v1",
                                     "AFTERCARE_LLM_MODEL": "qwen-plus", "AFTERCARE_LLM_API_KEY": ""}), \
                patch.object(agent, "_chat", side_effect=AssertionError("unexpected network call")):
            self.assertEqual(agent.configured_mode(), "offline")
            result = agent.plan("耳机换货政策是什么", {}, CONTEXT)
        self.assertEqual(result["mode"], "offline")
        self.assertEqual(result["action"], "policy")
        self.assertEqual(result["policy_ids"], ["EX-2026-02"])
        self.assertNotIn("order_id", result)

    def test_policy_tool_distinguishes_consent_from_stock_deduction(self):
        tools = agent.ReadTools({}, CONTEXT)
        for query, expected in [
            ("能从其他门店调货吗", "AC-STOCK"),
            ("办理前要我点头吗", "AC-CONFIRM"),
            ("确认成功扣减几件", "AC-STOCK"),
        ]:
            with self.subTest(query=query):
                hits = tools.call("search_policy", {"query": query})["clauses"]
                self.assertEqual(hits[0]["id"], expected)

    def test_benchmark_runs_and_reports_failures(self):
        results = evaluate()
        self.assertEqual(results["offline_planner"]["failures"], [])
        for row in results["retrieval"].values():
            self.assertGreater(row["n"], 0)
            self.assertEqual(len(row["top1_misses"]), round((1 - row["hit_at_1"]) * row["n"]))


if __name__ == "__main__":
    unittest.main()
