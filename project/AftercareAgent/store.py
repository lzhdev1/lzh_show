"""PostgreSQL storage. Each operation locks only its own browser's session."""
import os
from hashlib import sha256
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from catalog import BUSINESS_DATE, ORDERS, assess


def connect():
    return psycopg.connect(os.environ["AFTERCARE_DATABASE_URL"], row_factory=dict_row,
                           connect_timeout=5, application_name=os.getenv("PGAPPNAME") or "aftercare")


def initialize():
    with connect() as conn:
        # Concurrent worker starts must not race on the first catalog creation.
        conn.execute("SELECT pg_advisory_xact_lock(824103765)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_sessions (
                id uuid PRIMARY KEY, state jsonb NOT NULL,
                last_seen timestamptz NOT NULL DEFAULT now()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_stock (
                session_id uuid REFERENCES aftercare_sessions ON DELETE CASCADE,
                order_id text NOT NULL, quantity integer NOT NULL CHECK (quantity >= 0),
                PRIMARY KEY (session_id, order_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_tickets (
                session_id uuid REFERENCES aftercare_sessions ON DELETE CASCADE,
                order_id text NOT NULL, id text NOT NULL, name text NOT NULL,
                proposal_id text NOT NULL,
                PRIMARY KEY (session_id, order_id), UNIQUE (session_id, proposal_id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_requests (
                session_id uuid REFERENCES aftercare_sessions ON DELETE CASCADE,
                id text NOT NULL, fingerprint text NOT NULL,
                PRIMARY KEY (session_id, id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_llm_daily (
                day date PRIMARY KEY, turns integer NOT NULL CHECK (turns > 0)
            )
        """)
        conn.execute("ALTER TABLE aftercare_sessions ADD COLUMN IF NOT EXISTS generation bigint NOT NULL DEFAULT 0")
        conn.execute("ALTER TABLE aftercare_sessions ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_jobs (
                id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES aftercare_sessions ON DELETE CASCADE,
                request_id text NOT NULL, text text NOT NULL, generation bigint NOT NULL, revision bigint NOT NULL,
                status text NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled')),
                attempts integer NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
                budget_state text CHECK (budget_state IN ('reserved','denied','offline')),
                error text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
                updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE (session_id, request_id)
            )
        """)
        conn.execute("""CREATE UNIQUE INDEX IF NOT EXISTS aftercare_one_active ON aftercare_jobs(session_id)
                        WHERE status IN ('queued','running')""")
        conn.execute("""CREATE INDEX IF NOT EXISTS aftercare_ready ON aftercare_jobs(created_at,id)
                        WHERE status='queued'""")
        conn.execute("""CREATE INDEX IF NOT EXISTS aftercare_recent ON aftercare_jobs(session_id,created_at DESC)""")
        conn.execute("""CREATE INDEX IF NOT EXISTS aftercare_leases ON aftercare_jobs(lease_until)
                        WHERE lease_token IS NOT NULL""")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS aftercare_job_attempts (
                job_id uuid REFERENCES aftercare_jobs ON DELETE CASCADE, attempt integer NOT NULL,
                status text NOT NULL, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
                finished_at timestamptz, PRIMARY KEY (job_id, attempt)
            )
        """)


def reserve_model_turn(conn):
    """The job's budget marker and project-wide debit share this short transaction."""
    limit = setting("AFTERCARE_LLM_DAILY_TURNS", 100, minimum=0)
    if not limit:
        return False
    row = conn.execute("""
            INSERT INTO aftercare_llm_daily(day, turns)
            VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date, 1)
            ON CONFLICT (day) DO UPDATE SET turns=aftercare_llm_daily.turns+1
            WHERE aftercare_llm_daily.turns < %s
            RETURNING turns
    """, (limit,)).fetchone()
    return row is not None


def initial_state():
    return {"messages": [], "proposal": None, "selected_order_id": None,
            "pending_exchange": False, "stage": "idle", "mode": "offline"}


def session_id(raw):
    try:
        return UUID(raw) if raw else None
    except (ValueError, TypeError):
        return None


def seed_stock(conn, sid):
    with conn.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO aftercare_stock (session_id, order_id, quantity) VALUES (%s,%s,%s)",
            [(sid, o["id"], o["stock"]) for o in ORDERS],
        )


def create_session(conn):
    # Cookie expiry and storage retention use the same rolling seven-day window.
    conn.execute("DELETE FROM aftercare_sessions WHERE last_seen < now() - interval '7 days'")
    sid = uuid4()
    state = initial_state()
    conn.execute("INSERT INTO aftercare_sessions(id, state) VALUES (%s,%s)", (sid, Jsonb(state)))
    seed_stock(conn, sid)
    return sid, state


def load(conn, sid):
    if sid is None:
        return None
    row = conn.execute(
        "SELECT state FROM aftercare_sessions WHERE id=%s AND last_seen >= now() - interval '7 days' FOR UPDATE",
        (sid,),
    ).fetchone()
    if row:
        conn.execute("UPDATE aftercare_sessions SET last_seen=now() WHERE id=%s", (sid,))
        return row["state"]
    return None


def read_state(conn, sid):
    row = conn.execute("""SELECT state FROM aftercare_sessions
                          WHERE id=%s AND last_seen >= now() - interval '7 days'""", (sid,)).fetchone()
    return row["state"] if row else None


def touch_if_stale(conn, sid):
    conn.execute("""UPDATE aftercare_sessions SET last_seen=now()
                    WHERE id=%s AND last_seen >= now() - interval '7 days'
                      AND last_seen < now() - interval '1 hour'""", (sid,))


def save(conn, sid, state):
    conn.execute("UPDATE aftercare_sessions SET state=%s, revision=revision+1 WHERE id=%s", (Jsonb(state), sid))


def snapshot(conn, sid, state):
    stock = {row["order_id"]: row["quantity"] for row in conn.execute(
        "SELECT order_id,quantity FROM aftercare_stock WHERE session_id=%s", (sid,))}
    tickets = conn.execute(
        "SELECT id,order_id,name FROM aftercare_tickets WHERE session_id=%s ORDER BY order_id", (sid,)
    ).fetchall()
    ticket_ids = {t["order_id"]: t["id"] for t in tickets}
    orders = [assess(o, stock[o["id"]], ticket_ids.get(o["id"])) for o in ORDERS]
    return {**state, "today": BUSINESS_DATE.isoformat(), "orders": orders, "tickets": tickets}


def record_request(conn, sid, request_id, fingerprint):
    previous = conn.execute(
        "SELECT fingerprint FROM aftercare_requests WHERE session_id=%s AND id=%s", (sid, request_id)
    ).fetchone()
    if previous:
        if previous["fingerprint"] != fingerprint:
            raise ValueError("该请求编号已用于其他操作。")
        return False
    conn.execute("INSERT INTO aftercare_requests(session_id,id,fingerprint) VALUES (%s,%s,%s)",
                 (sid, request_id, fingerprint))
    return True


def add_ticket(conn, sid, proposal):
    ticket_id = "EX-" + uuid4().hex[:12].upper()
    changed = conn.execute("""
        UPDATE aftercare_stock SET quantity=quantity-1
        WHERE session_id=%s AND order_id=%s AND quantity > 0 RETURNING quantity
    """, (sid, proposal["order_id"])).fetchone()
    if not changed:
        raise ValueError("同规格库存不足，无法创建工单。")
    conn.execute("""
        INSERT INTO aftercare_tickets(session_id, order_id, id, name, proposal_id)
        VALUES (%s,%s,%s,%s,%s)
    """, (sid, proposal["order_id"], ticket_id, proposal["name"], proposal["id"]))
    return ticket_id


def ticket_for_proposal(conn, sid, proposal_id):
    return conn.execute("SELECT id FROM aftercare_tickets WHERE session_id=%s AND proposal_id=%s",
                        (sid, proposal_id)).fetchone()


def reset(conn, sid):
    conn.execute("""UPDATE aftercare_jobs SET status='cancelled',error='session_reset',updated_at=clock_timestamp()
                    WHERE session_id=%s AND status IN ('queued','running')""", (sid,))
    conn.execute("UPDATE aftercare_sessions SET generation=generation+1 WHERE id=%s", (sid,))
    conn.execute("DELETE FROM aftercare_tickets WHERE session_id=%s", (sid,))
    conn.execute("DELETE FROM aftercare_stock WHERE session_id=%s", (sid,))
    seed_stock(conn, sid)
    state = initial_state()
    save(conn, sid, state)
    return state


class JobConflict(ValueError):
    pass


class JobLimit(ValueError):
    pass


class QueueFull(ValueError):
    pass


def setting(name, default, minimum=1):
    raw = os.getenv(name, "").strip()
    value = int(raw) if raw else default
    if value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")
    return value


def lease_seconds():
    return setting("AFTERCARE_JOB_LEASE_SECONDS", 60)


def public_job(row):
    if not row:
        return None
    return {"id": str(row["id"]), **{k: row[k] for k in
            ("status", "text", "attempts", "request_id", "created_at", "updated_at", "error")}}


def job_for_session(conn, sid, job_id):
    key = session_id(str(job_id))
    row = conn.execute("SELECT * FROM aftercare_jobs WHERE session_id=%s AND id=%s", (sid, key)).fetchone()
    return public_job(row)


def active_job(conn, sid):
    return public_job(conn.execute("""SELECT * FROM aftercare_jobs WHERE session_id=%s
                                    AND status IN ('queued','running')""", (sid,)).fetchone())


def latest_job(conn, sid):
    return public_job(conn.execute("""
        SELECT j.* FROM aftercare_jobs j JOIN aftercare_sessions s ON s.id=j.session_id
        WHERE j.session_id=%s AND j.generation=s.generation ORDER BY j.created_at DESC,j.id DESC LIMIT 1
    """, (sid,)).fetchone())


def job_receipt(conn, sid, request_id, action, value):
    fingerprint = sha256((action + "\n" + value).encode()).hexdigest()
    try:
        return record_request(conn, sid, request_id, fingerprint)
    except ValueError as exc:
        raise JobConflict(str(exc)) from exc


def enqueue(conn, sid, request_id, text):
    """The caller has locked the session. Durable replay wins over rate and queue limits."""
    fresh = job_receipt(conn, sid, request_id, "message", text)
    if not fresh:
        prior = conn.execute("SELECT * FROM aftercare_jobs WHERE session_id=%s AND request_id=%s",
                             (sid, request_id)).fetchone()
        if prior:
            return public_job(prior), False
        # A matching receipt from the old synchronous endpoint represents already committed work.
    if fresh and active_job(conn, sid):
        raise JobConflict("当前会话已有待处理任务，请等待完成或先取消。")
    if fresh:
        recent = conn.execute("""SELECT count(*) AS n FROM aftercare_jobs WHERE session_id=%s
                                 AND created_at > clock_timestamp() - interval '1 minute'""", (sid,)).fetchone()
        if recent["n"] >= setting("AFTERCARE_SESSION_TURNS_PER_MINUTE", 12):
            raise JobLimit("该会话最近一分钟提交次数已达上限，请稍后再试。")
        # Serialize only admission decisions, including across ASGI processes.
        conn.execute("SELECT pg_advisory_xact_lock(824103766)")
        queued = conn.execute("SELECT count(*) AS n FROM aftercare_jobs WHERE status IN ('queued','running')").fetchone()
        if queued["n"] >= setting("AFTERCARE_QUEUE_LIMIT", 64):
            raise QueueFull("处理队列已满，请稍后再试。")
    row = conn.execute("""
        INSERT INTO aftercare_jobs(id, session_id, request_id, text, generation, revision, status)
        SELECT %s,id,%s,%s,generation,revision,%s FROM aftercare_sessions WHERE id=%s RETURNING *
    """, (uuid4(), request_id, text, "queued" if fresh else "completed", sid)).fetchone()
    return public_job(row), fresh


def cancel_job(conn, sid, job_id, request_id):
    target = job_for_session(conn, sid, job_id)
    if target is None:
        return None
    if job_receipt(conn, sid, request_id, "cancel_job", target["id"]):
        # A cancelled in-flight job keeps its slot while its synchronous network call drains.
        conn.execute("""UPDATE aftercare_jobs SET status='cancelled',error='user_cancelled',updated_at=clock_timestamp()
                        WHERE id=%s AND session_id=%s AND status IN ('queued','running')""", (target["id"], sid))
    return job_for_session(conn, sid, job_id)


def reap_expired(conn):
    limit = setting("AFTERCARE_JOB_MAX_ATTEMPTS", 2)
    conn.execute("""
        WITH expired AS (
            UPDATE aftercare_jobs SET
                status=CASE WHEN status='cancelled' THEN 'cancelled' WHEN attempts >= %s THEN 'failed' ELSE 'queued' END,
                error=CASE WHEN status='cancelled' THEN error ELSE 'lease_expired' END,
                lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
            WHERE lease_token IS NOT NULL AND lease_until <= clock_timestamp() RETURNING id,attempts
        )
        UPDATE aftercare_job_attempts a SET status='expired',finished_at=clock_timestamp()
        FROM expired e WHERE a.job_id=e.id AND a.attempt=e.attempts
    """, (limit,))


def claim_job():
    with connect() as conn:
        # Serialize the count-and-claim transaction only. Contending workers can claim the
        # next free slot immediately after commit rather than losing an entire poll interval.
        conn.execute("SELECT pg_advisory_xact_lock(824103767)")
        reap_expired(conn)
        used = conn.execute("SELECT count(*) AS n FROM aftercare_jobs WHERE lease_token IS NOT NULL").fetchone()["n"]
        if used >= setting("AFTERCARE_MAX_RUNNING", 4):
            return None
        row = conn.execute("""
            WITH candidate AS (
                SELECT id FROM aftercare_jobs WHERE status='queued'
                ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
            )
            UPDATE aftercare_jobs j SET status='running',attempts=attempts+1,
                lease_token=%s,lease_until=clock_timestamp()+%s*interval '1 second',updated_at=clock_timestamp()
            FROM candidate c WHERE j.id=c.id RETURNING j.*
        """, (uuid4(), lease_seconds())).fetchone()
        if row:
            conn.execute("INSERT INTO aftercare_job_attempts(job_id,attempt,status) VALUES (%s,%s,'running')",
                         (row["id"], row["attempts"]))
        return row


def renew_lease(job):
    with connect() as conn:
        return bool(conn.execute("""
            UPDATE aftercare_jobs SET lease_until=clock_timestamp()+%s*interval '1 second'
            WHERE id=%s AND lease_token=%s AND lease_until > clock_timestamp() RETURNING id
        """, (lease_seconds(), job["id"], job["lease_token"])).fetchone())


def is_attempt_active(job):
    with connect() as conn:
        return bool(conn.execute("""
            SELECT 1 FROM aftercare_jobs j JOIN aftercare_sessions s ON s.id=j.session_id
            WHERE j.id=%s AND j.lease_token=%s AND j.status='running' AND j.lease_until > clock_timestamp()
              AND (j.revision,j.generation)=(s.revision,s.generation)
        """, (job["id"], job["lease_token"])).fetchone())


def lock_attempt(conn, job):
    # Keep lock order identical to reset/cancel/confirm: session first, then job.
    session = conn.execute("SELECT state,generation,revision FROM aftercare_sessions WHERE id=%s FOR UPDATE",
                           (job["session_id"],)).fetchone()
    row = conn.execute("""SELECT * FROM aftercare_jobs WHERE id=%s AND lease_token=%s
                          AND lease_until > clock_timestamp() FOR UPDATE""",
                       (job["id"], job["lease_token"])).fetchone()
    if not session or not row:
        return None, None
    if row["status"] == "cancelled" or (row["generation"], row["revision"]) != (session["generation"], session["revision"]):
        close_attempt(conn, row, "cancelled", row["error"] if row["status"] == "cancelled" else "session_changed")
        return None, None
    return row, session["state"]


def close_attempt(conn, row, status, error=None):
    """The caller holds the current attempt's job lock and validated its lease token."""
    conn.execute("""UPDATE aftercare_job_attempts SET status=%s,finished_at=clock_timestamp()
                    WHERE job_id=%s AND attempt=%s""",
                 ("failed" if status == "queued" else status, row["id"], row["attempts"]))
    conn.execute("""UPDATE aftercare_jobs SET status=%s,error=%s,lease_token=NULL,lease_until=NULL,
                    updated_at=clock_timestamp() WHERE id=%s""", (status, error, row["id"]))


def prepare_attempt(job, snapshot_fn, configured):
    with connect() as conn:
        row, state = lock_attempt(conn, job)
        if not row:
            return None
        view = snapshot_fn(conn, row["session_id"], state)
        marker = row["budget_state"]
        if marker is None:
            marker = "offline"
            if configured:
                marker = "reserved" if reserve_model_turn(conn) else "denied"
            conn.execute("UPDATE aftercare_jobs SET budget_state=%s WHERE id=%s", (marker, row["id"]))
            recovered = False
        else:
            recovered = marker == "reserved"
        # A previous process may already have reached the provider. Recover locally rather than
        # debit a second turn or submit an unprovably-idempotent external request again.
        reason = "interrupted_model_turn" if recovered else "daily_turn_limit" if marker == "denied" else None
        if marker == "offline" and configured:
            reason = "recovered_offline_turn"
        return view, reason


def finish_attempt(job, decision, snapshot_fn, apply_plan):
    with connect() as conn:
        row, state = lock_attempt(conn, job)
        if not row:
            return False
        sid = row["session_id"]
        view = snapshot_fn(conn, sid, state)
        state["messages"].append({"role": "user", "text": row["text"]})
        apply_plan(state, view, decision)
        save(conn, sid, state)
        close_attempt(conn, row, "completed")
        return True


def fail_attempt(job):
    with connect() as conn:
        row, _state = lock_attempt(conn, job)
        if row:
            status = "failed" if row["attempts"] >= setting("AFTERCARE_JOB_MAX_ATTEMPTS", 2) else "queued"
            close_attempt(conn, row, status, "processing_failed")
