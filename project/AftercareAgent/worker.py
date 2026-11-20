"""Process the durable PostgreSQL queue without holding a connection during a model call."""
import logging
from threading import Event, Thread
from time import monotonic

import agent
from catalog import POLICIES
import store


log = logging.getLogger("aftercare.worker")


def heartbeat(job, done):
    interval = max(0.2, store.lease_seconds() / 3)
    while not done.wait(interval):
        try:
            if not store.renew_lease(job):
                return
        except Exception:
            # A connection outage may cost this attempt its lease. The token check on completion
            # then discards the stale result instead of overwriting a recovered attempt.
            log.exception("Lease renewal failed for job %s", job["id"])


def run_job(job, snapshot, apply_plan):
    done = Event()
    monitor = Thread(target=heartbeat, args=(job, done), name="aftercare-lease", daemon=True)
    monitor.start()
    try:
        prepared = store.prepare_attempt(job, snapshot, agent.configured_mode() == "llm")
        if prepared is None:
            return
        view, reason = prepared
        context = {"orders": view["orders"], "policies": POLICIES}
        decision = agent.plan(job["text"], view, context, offline_reason=reason,
                              should_continue=lambda: store.is_attempt_active(job))
        store.finish_attempt(job, decision, snapshot, apply_plan)
    except agent.PlanInterrupted:
        # Cancellation, reset or lease loss is a normal terminal event for this attempt.
        store.fail_attempt(job)
    except Exception:
        log.exception("Processing failed for job %s, attempt %d", job["id"], job["attempts"])
        store.fail_attempt(job)
    finally:
        done.set()
        monitor.join(timeout=1)


class Workers:
    def __init__(self, snapshot, apply_plan):
        self.snapshot = snapshot
        self.apply_plan = apply_plan
        self.stopping = Event()
        self.wakeup = Event()
        count = store.setting("AFTERCARE_WORKER_THREADS", 2)
        self.threads = [Thread(target=self.run, name=f"aftercare-worker-{n}", daemon=True) for n in range(count)]

    def wake(self):
        self.wakeup.set()

    def run(self):
        while not self.stopping.is_set():
            try:
                job = store.claim_job()
                if job:
                    run_job(job, self.snapshot, self.apply_plan)
                    continue
            except Exception:
                log.exception("Aftercare queue temporarily unavailable")
            # Local submissions wake workers immediately. Other ASGI instances and expired
            # leases are discovered by polling even after a process dies without a notification.
            self.wakeup.wait(1.5)
            self.wakeup.clear()


def start_workers(*, snapshot, apply_plan):
    service = Workers(snapshot, apply_plan)
    for thread in service.threads:
        thread.start()
    return service


def notify_workers(manager):
    manager.wake()


def stop_workers(manager):
    manager.stopping.set()
    manager.wake()
    deadline = monotonic() + 2
    for thread in manager.threads:
        thread.join(timeout=max(0, deadline - monotonic()))
