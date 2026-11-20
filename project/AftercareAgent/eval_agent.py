"""Reproduce the offline planner and retrieval benchmarks: python eval_agent.py [--json]."""

import argparse
import json
import math
from time import perf_counter

from agent import ReadTools, offline
from catalog import BUSINESS_DATE, ORDERS, POLICIES, assess
from retrieval import search_policies


# Hand-labelled demonstration cases, fixed before comparison; not customer traffic.
RETRIEVAL_CASES = [
    ("签收后多久能换货", "2026-10-31", "EX-2026-01"),
    ("签收后多久能换货", "2026-11-01", "EX-2026-02"),
    ("到手几天还来得及", "2026-10-19", "EX-2026-01"),
    ("同款置换期限", "2026-11-19", "EX-2026-02"),
    ("10 月下单，收货当天怎么计算", "2026-10-28", "EX-2026-01"),
    ("到货多少天申请有效", "2026-11-16", "EX-2026-02"),
    ("无同规格库存如何处理", None, "AC-STOCK"),
    ("库房断货怎么办", None, "AC-STOCK"),
    ("仓库没有现货", None, "AC-STOCK"),
    ("确认成功扣减几件", None, "AC-STOCK"),
    ("没有可调拨的货", None, "AC-STOCK"),
    ("重复确认会怎样", None, "AC-CONFIRM"),
    ("连续按按钮会出现两张单吗", None, "AC-CONFIRM"),
    ("申请需要我先点头吗", None, "AC-CONFIRM"),
    ("工单是不是自动生成", None, "AC-CONFIRM"),
    ("再按一遍会怎样", None, "AC-CONFIRM"),
    ("退款需要联系谁", None, "AC-SCOPE"),
    ("能退钱给我吗", None, "AC-SCOPE"),
    ("是否支持赔付", None, "AC-SCOPE"),
    ("机器坏了可以上门修理吗", None, "AC-SCOPE"),
    ("能不能换别的型号", None, "AC-SCOPE"),
]

PLANNER_CASES = [
    ("帮我给耳机换货", {}, "clarify", None, None),
    ("AC-1002", {"pending_exchange": True}, "exchange", "AC-1002", "EX-2026-02"),
    ("我要白色那副", {"pending_exchange": True}, "exchange", "AC-1002", "EX-2026-02"),
    ("黑色坏了想换新", {}, "exchange", "AC-1001", "EX-2026-02"),
    ("想给便携音响换货", {}, "exchange", "AC-1003", "EX-2026-01"),
    ("键盘不能用，帮我换", {}, "exchange", "AC-1004", "AC-STOCK"),
    ("换货 AC-9999", {}, "clarify", None, None),
    ("不换了", {"proposal": {"id": "sample"}}, "cancel", None, None),
    ("查看我的订单", {}, "list_orders", None, None),
    ("帮我查工单进度", {}, "status", None, None),
    ("AC-1004 库存还剩几件", {}, "answer", "AC-1004", None),
    ("我想退款", {}, "policy", None, "AC-SCOPE"),
    ("旧版的换货政策", {}, "policy", None, "EX-2026-01"),
    ("AC-1003 的换货期限", {}, "policy", "AC-1003", "EX-2026-01"),
    ("2026-11-01 下单适用什么换货规则", {}, "policy", None, "EX-2026-02"),
    ("重复确认两次会生成什么", {}, "policy", None, "AC-CONFIRM"),
    ("有优惠券吗", {}, "answer", None, None),
]


def evaluate():
    retrieval = {}
    for method in ("keyword", "vector"):
        ranks = []
        misses = []
        for text, on, expected in RETRIEVAL_CASES:
            hits = search_policies(text, POLICIES, on=on or BUSINESS_DATE.isoformat(), method=method)
            rank = next((i for i, hit in enumerate(hits, 1) if hit["id"] == expected), 0)
            ranks.append(rank)
            if rank != 1:
                misses.append({"query": text, "expected": expected, "first": hits[0]["id"] if hits else None})
        n = len(ranks)
        retrieval[method] = {"n": n, "hit_at_1": sum(r == 1 for r in ranks) / n,
                             "recall_at_3": sum(r > 0 for r in ranks) / n,
                             "mrr_at_3": sum(1 / r for r in ranks if r) / n, "top1_misses": misses}
    context = {"orders": [assess(o, o["stock"]) for o in ORDERS], "policies": POLICIES}
    failures, latencies = [], []
    for text, state, action, order_id, policy_id in PLANNER_CASES:
        start = perf_counter()
        decision = offline(text, state, ReadTools(state, context))
        latencies.append(1000 * (perf_counter() - start))
        if (decision["action"] != action or decision.get("order_id") != order_id
                or (policy_id and policy_id not in decision["policy_ids"])):
            failures.append({"query": text, "expected": [action, order_id, policy_id],
                             "actual": [decision["action"], decision.get("order_id"), decision["policy_ids"]]})
    return {"fixture": "固定模拟政策及订单；离线规则与本地检索；不测网络、数据库或真实模型。",
            "retrieval": retrieval,
            "offline_planner": {"n": len(latencies), "passed": len(latencies) - len(failures),
                                "p95_ms": sorted(latencies)[math.ceil(len(latencies) * .95) - 1], "failures": failures}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="print complete metrics and individual misses")
    args = parser.parse_args()
    report = evaluate()
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(report["fixture"])
        for method, result in report["retrieval"].items():
            print(f"{method:8} n={result['n']}  Hit@1={result['hit_at_1']:.1%}  Recall@3={result['recall_at_3']:.1%}  MRR@3={result['mrr_at_3']:.3f}")
        planner = report["offline_planner"]
        print(f"offline planner: {planner['passed']}/{planner['n']} passed; P95={planner['p95_ms']:.2f} ms")
        for failure in planner["failures"]:
            print(failure)
    raise SystemExit(bool(report["offline_planner"]["failures"]))
