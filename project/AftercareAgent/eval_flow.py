"""Run isolated black-box regressions against the running HTTP service (stdlib only)."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.cookies import SimpleCookie
import json
from time import perf_counter
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4


class Browser:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")
        self.cookie = ""

    def call(self, path, body=None, status=200, *, headers=None):
        headers = {"Content-Type": "application/json", **(headers or {})}
        if self.cookie:
            headers["Cookie"] = self.cookie
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        req = Request(self.base + "/api/" + path, data=data, headers=headers)
        try:
            response = urlopen(req, timeout=60)
        except HTTPError as error:
            response = error
        with response:
            result = json.load(response)
            self.last_status = response.status
            self.last_headers = response.headers
            expected = (status,) if isinstance(status, int) else status
            if response.status not in expected:
                raise AssertionError(f"{path}: HTTP {response.status}, expected {status}. {result}")
            if not self.cookie:
                cookies = SimpleCookie(response.headers.get("Set-Cookie", ""))
                item = cookies.get("aftercare_session")
                if not item or not item["httponly"]:
                    raise AssertionError("Session response must establish an HttpOnly cookie")
                self.cookie = "aftercare_session=" + item.value
        return result

    def say(self, text, request_id=None):
        return self.call("messages", {"text": text, "request_id": request_id or uuid4().hex})

    def confirm(self, proposal_id, request_id=None, status=200):
        return self.call("confirm", {"proposal_id": proposal_id, "request_id": request_id or uuid4().hex}, status)


def check(condition, reason):
    if not condition:
        raise AssertionError(reason)


def quantities(view):
    return {order["id"]: order["stock"] for order in view["orders"]}


def run(base_url):
    user, other = Browser(base_url), Browser(base_url)
    start = user.call("session")
    peer = other.call("session")
    baseline = quantities(start)
    modes = set()
    checks = []
    check(baseline == quantities(peer) and not start["tickets"] and not peer["tickets"], "initial state")

    def passed(name, view):
        modes.add(view["mode"])
        checks.append(name)

    text, key = "帮我换一下耳机，还是同款", uuid4().hex
    view = user.say(text, key)
    check(view["stage"] == "clarifying" and not view["proposal"] and not view["tickets"], "ambiguous order")
    answer = view["messages"][-1]["text"]
    check("AC-1001" in answer and "AC-1002" in answer, "both candidates must be named")
    passed("ambiguous headphones require order selection", view)

    duplicate = user.say(text, key)
    check(duplicate["messages"] == view["messages"], "replayed message was duplicated")
    user.call("messages", {"text": "不同的请求", "request_id": key}, status=409)
    passed("message idempotency and mismatched-key rejection", duplicate)

    view = user.say("曜石黑")
    proposal = view["proposal"]
    check(proposal and proposal["order_id"] == "AC-1001" and not view["tickets"], "draft selection")
    check(quantities(view) == baseline, "preparing a draft changed stock")
    check("EX-2026-02" in [p["id"] for p in view["messages"][-1]["citations"]], "current policy citation")
    check(user.call("session")["proposal"] == proposal, "draft did not persist on reload")
    passed("selection creates a persistent draft with no stock change", view)

    view = user.say("取消换货")
    check(view["proposal"] is None and view["stage"] == "idle", "cancel did not clear the draft")
    user.confirm(proposal["id"], status=409)
    check(not view["tickets"] and quantities(view) == baseline, "cancellation mutated stock or tickets")
    passed("cancel invalidates prior confirmation", view)

    for order_id, expected_clause in [("AC-1003", "EX-2026-01"), ("AC-1004", "AC-STOCK")]:
        view = user.say(f"换货 {order_id}")
        check(not view["proposal"] and not view["tickets"] and quantities(view) == baseline, "ineligible exchange")
        check(expected_clause in [p["id"] for p in view["messages"][-1]["citations"]], "wrong denial citation")
        passed(f"denial is cited and side-effect-free for {order_id}", view)

    view = user.say("帮我换 AC-1002 雾白耳机")
    proposal = view["proposal"]
    check(proposal and proposal["order_id"] == "AC-1002", "expected a draft for the white headphones")
    other.confirm(proposal["id"], status=409)
    check(not other.call("session")["tickets"], "foreign confirmation affected the peer")
    passed("another browser cannot confirm the draft", view)

    # Two different click IDs and a retry of one ID race against the exact same draft.
    shared_key = uuid4().hex
    keys = [shared_key, uuid4().hex, shared_key]
    with ThreadPoolExecutor(max_workers=len(keys)) as pool:
        attempts = list(pool.map(lambda rid: user.confirm(proposal["id"], rid), keys))
    expected = {**baseline, "AC-1002": baseline["AC-1002"] - 1}
    for result in attempts:
        check(len(result["tickets"]) == 1 and quantities(result) == expected, "duplicate stock/ticket mutation")
    final = user.call("session")
    check(final["tickets"][0]["order_id"] == "AC-1002" and not final["proposal"] and final["stage"] == "idle",
          "invalid final order, proposal or stage")
    check(all(result["tickets"] == final["tickets"] for result in attempts), "racing results disagree")
    passed("concurrent confirmations and retries create one ticket and reserve one item", final)

    view = user.say("查询工单")
    check(final["tickets"][0]["id"] in view["messages"][-1]["text"], "ticket lookup missing created ID")
    again = user.say("再给 AC-1002 换货")
    check(not again["proposal"] and again["tickets"] == final["tickets"] and quantities(again) == expected,
          "a second request for a fulfilled order changed state")
    passed("ticket lookup and repeated application preserve final state", again)

    peer = other.call("session")
    check(peer["messages"] == [] and peer["proposal"] is None and peer["tickets"] == [] and quantities(peer) == baseline,
          "session isolation failed")
    passed("other browser retains original inventory, conversation, and tickets", peer)

    fresh = user.call("reset", {})
    check(not fresh["messages"] and not fresh["tickets"] and not fresh["proposal"] and quantities(fresh) == baseline,
          "reset did not restore the demo")
    passed("reset restores the session's initial state", fresh)
    return {"passed": len(checks), "modes": sorted(modes), "checks": checks}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/aftercare",
                        help="Service or public gateway URL including /aftercare")
    started = perf_counter()
    result = run(parser.parse_args().base_url)
    print(json.dumps({**result, "elapsed_seconds": round(perf_counter() - started, 3)}, indent=2))
