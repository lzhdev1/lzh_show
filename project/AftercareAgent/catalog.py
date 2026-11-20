"""Versioned demonstration policies and the orders seeded into every private session."""
from datetime import date


BUSINESS_DATE = date(2026, 11, 20)
POLICIES = [
    {
        "id": "EX-2026-01", "title": "旧版同规格换货政策",
        "effective_from": "2026-01-01", "effective_to": "2026-10-31", "days": 7,
        "text": "2026 年 1 月 1 日至 10 月 31 日下单的商品，签收后 7 天内可申请同款同色换货。签收次日为第 1 天，第 7 天当日仍可申请。",
    },
    {
        "id": "EX-2026-02", "title": "现行同规格换货政策",
        "effective_from": "2026-11-01", "effective_to": None, "days": 15,
        "text": "2026 年 11 月 1 日起下单的商品，签收后 15 天内可申请同款同色换货。签收次日为第 1 天，第 15 天当日仍可申请。",
    },
    {
        "id": "AC-STOCK", "title": "换货库存规则",
        "effective_from": "2026-01-01", "effective_to": None,
        "text": "按订单的商品和规格查询可用换货库存。无同规格库存时不能创建换货工单，可联系人工客服。确认成功后扣减 1 件。",
    },
    {
        "id": "AC-CONFIRM", "title": "换货确认与重复提交",
        "effective_from": "2026-01-01", "effective_to": None,
        "text": "申请仅限同款同色。核对草稿并点击确认后才生成工单。确认前可取消。每笔订单限建一个换货工单，重复确认不会再次扣减库存。",
    },
    {
        "id": "AC-SCOPE", "title": "演示服务范围",
        "effective_from": "2026-01-01", "effective_to": None,
        "text": "本服务支持同规格换货、订单与工单查询。退款、赔偿、上门维修及跨规格换货需联系商家人工客服。",
    },
]

ORDERS = [
    {"id": "AC-1001", "name": "AirLoop 无线耳机", "variant": "曜石黑", "ordered": "2026-11-15", "delivered": "2026-11-17", "stock": 3},
    {"id": "AC-1002", "name": "AirLoop 无线耳机", "variant": "雾白", "ordered": "2026-11-07", "delivered": "2026-11-09", "stock": 2},
    {"id": "AC-1003", "name": "便携音箱", "variant": "深空灰", "ordered": "2026-10-30", "delivered": "2026-11-10", "stock": 1},
    {"id": "AC-1004", "name": "机械键盘", "variant": "青柠绿", "ordered": "2026-11-16", "delivered": "2026-11-19", "stock": 0},
]


def citations(ids):
    by_id = {p["id"]: p for p in POLICIES}
    return [
        {key: by_id[policy_id][key] for key in ("id", "title", "text")}
        for policy_id in dict.fromkeys(ids) if policy_id in by_id
    ]


def assess(order, stock, ticket_id=None):
    policy = next(p for p in POLICIES if "days" in p and p["effective_from"] <= order["ordered"]
                  and (p["effective_to"] is None or order["ordered"] <= p["effective_to"]))
    elapsed = (BUSINESS_DATE - date.fromisoformat(order["delivered"])).days
    eligible = False
    reason_id = policy["id"]
    if ticket_id:
        reason = f"该订单已创建工单 {ticket_id}。"
        reason_id = "AC-CONFIRM"
    elif elapsed > policy["days"]:
        reason = f"已签收 {elapsed} 天，超过此订单适用的 {policy['days']} 天换货时限。"
    elif stock < 1:
        reason = "同规格暂无可用换货库存，请联系人工客服。"
        reason_id = "AC-STOCK"
    else:
        eligible = True
        reason = f"签收后第 {elapsed} 天，符合 {policy['days']} 天换货时限，同规格库存可用。"
    return {**order, "stock": stock, "eligible": eligible, "reason": reason,
            "policy_id": policy["id"], "reason_id": reason_id}
