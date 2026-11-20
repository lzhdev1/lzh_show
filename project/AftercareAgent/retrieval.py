"""Small-corpus clause retrieval. The vector baseline uses sparse TF-IDF, not neural embeddings."""

import math
import re
import unicodedata
from collections import Counter


# A small, auditable domain vocabulary for paraphrases not covered by character bigrams.
CONCEPTS = {
    "availability": ("库存", "缺货", "没货", "有货", "没现货", "无货", "补货", "还有货", "断货", "仓库", "调拨", "调货"),
    "confirm": ("确认", "提交", "同意", "点头", "授权", "批准", "按按钮"),
    "duplicate": ("重复", "两次", "两张", "第二次", "一个工单", "一个换货工单", "一次", "幂等", "连点"),
    "unsupported": ("退款", "退钱", "返还货款", "赔偿", "赔付", "赔钱", "维修", "修理", "上门", "报修"),
    "window": ("签收", "收货", "到货", "到手", "时限", "期限", "几天", "多少天", "多久", "过期", "超期", "自然日"),
    "exchange": ("换货", "更换", "置换", "换新", "调换"),
}


def normalize(text):
    return unicodedata.normalize("NFKC", str(text or "")).lower()


def _features(text, method):
    text = normalize(text)
    counts = Counter()
    for part in re.findall(r"[a-z0-9]+|[\u3400-\u9fff]+", text):
        if part.isascii() or len(part) == 1:
            counts[part] += 1
        else:
            counts.update(part[i:i + 2] for i in range(len(part) - 1))
    if method == "vector":
        for concept, expressions in CONCEPTS.items():
            # Count distinct expressions once each; repeating the same wording adds no concept weight.
            matched = sum(expression in text for expression in expressions)
            if matched:
                counts["concept:" + concept] = matched
    return counts


def search_policies(query, policies, *, on=None, method="vector", limit=3):
    """Return positive-scoring hits. Inclusive ISO dates filter versions before ranking."""
    if method not in {"keyword", "vector"}:
        raise ValueError("Unknown ranking method")
    docs = [doc for doc in policies if not on or (
        (not doc.get("effective_from") or doc["effective_from"] <= on)
        and (not doc.get("effective_to") or on <= doc["effective_to"])
    )]
    raw = [_features(f"{d['title']} {d['text']} {d['id']}", method) for d in docs]
    terms = _features(query, method)
    frequencies = Counter(term for counts in raw for term in counts)
    idf = {t: 1 + math.log((len(docs) + 1) / (df + 1)) for t, df in frequencies.items()}

    def weighted(counts):
        return {t: (1 + math.log(n)) * idf[t] * (4 if t.startswith("concept:") else 1)
                for t, n in counts.items() if t in idf}

    query_vector = weighted(terms)
    query_norm = math.sqrt(sum(value ** 2 for value in query_vector.values()))
    results = []
    for doc, counts in zip(docs, raw):
        if method == "keyword":
            score = sum(idf[t] for t in terms if t in counts)
        else:
            document_vector = weighted(counts)
            dot = sum(value * document_vector.get(t, 0) for t, value in query_vector.items())
            norm = math.sqrt(sum(value ** 2 for value in document_vector.values()))
            score = dot / (query_norm * norm) if norm and query_norm else 0
        if score > 0:
            results.append({**doc, "score": round(score, 6)})
    return sorted(results, key=lambda d: (-d['score'], d['id']))[:limit]
