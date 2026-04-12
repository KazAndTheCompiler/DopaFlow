from __future__ import annotations

import logging
import time
from collections import OrderedDict
from types import SimpleNamespace

import pytest

from app.core import scheduler


def test_mark_task_spoken_caps_history() -> None:
    original_spoken_tasks = scheduler._spoken_tasks
    try:
        scheduler._spoken_tasks = OrderedDict()

        for index in range(scheduler._MAX_SPOKEN_TASKS):
            assert scheduler._mark_task_spoken(f"task-{index}") is True

        assert scheduler._mark_task_spoken("task-0") is False
        assert len(scheduler._spoken_tasks) == scheduler._MAX_SPOKEN_TASKS

        assert scheduler._mark_task_spoken("task-overflow") is True

        assert "task-1" not in scheduler._spoken_tasks
        assert "task-0" in scheduler._spoken_tasks
        assert "task-overflow" in scheduler._spoken_tasks
        assert len(scheduler._spoken_tasks) == scheduler._MAX_SPOKEN_TASKS
    finally:
        scheduler._spoken_tasks = original_spoken_tasks


def test_expire_spoken_tasks_evicts_old_entries() -> None:
    original_spoken_tasks = scheduler._spoken_tasks
    try:
        scheduler._spoken_tasks = OrderedDict()
        now = time.time()

        scheduler._spoken_tasks["old-1"] = now - 100000
        scheduler._spoken_tasks["old-2"] = now - 90000
        scheduler._spoken_tasks["recent"] = now - 1000
        scheduler._spoken_tasks["new"] = now

        scheduler._expire_spoken_tasks()

        assert "old-1" not in scheduler._spoken_tasks
        assert "old-2" not in scheduler._spoken_tasks
        assert "recent" in scheduler._spoken_tasks
        assert "new" in scheduler._spoken_tasks
        assert len(scheduler._spoken_tasks) == 2
    finally:
        scheduler._spoken_tasks = original_spoken_tasks


def test_mark_task_spoken_lru_moves_to_end() -> None:
    original_spoken_tasks = scheduler._spoken_tasks
    try:
        scheduler._spoken_tasks = OrderedDict()

        scheduler._spoken_tasks["a"] = time.time()
        scheduler._spoken_tasks["b"] = time.time()
        scheduler._spoken_tasks["c"] = time.time()

        assert scheduler._mark_task_spoken("a") is False
        assert list(scheduler._spoken_tasks.keys()) == ["b", "c", "a"]
    finally:
        scheduler._spoken_tasks = original_spoken_tasks


def test_materialize_recurring_tasks_logs_and_swallows_failures(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.domains.tasks import repository as tasks_repo

    def explode(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(tasks_repo, "materialize_recurring", explode)
    caplog.set_level(logging.ERROR, logger="app.core.scheduler")

    scheduler._materialize_recurring_tasks()

    assert any("Failed to materialize recurring tasks" in record.message for record in caplog.records)


def test_start_scheduler_uses_single_instance_when_called_twice(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[object] = []

    class FakeScheduler:
        def __init__(self) -> None:
            self.running = False
            self.jobs: list[str] = []
            created.append(self)

        def add_job(self, _func, _trigger, **kwargs) -> None:
            self.jobs.append(kwargs["id"])

        def start(self) -> None:
            self.running = True

    monkeypatch.setattr(scheduler, "BackgroundScheduler", FakeScheduler)
    original_scheduler = scheduler._scheduler
    try:
        scheduler._scheduler = None
        journal_service = SimpleNamespace(trigger_backup=lambda *_args, **_kwargs: None)

        scheduler.start_scheduler(journal_service)
        scheduler.start_scheduler(journal_service)

        assert len(created) == 1
        assert created[0].running is True
        assert created[0].jobs.count("nightly-journal-backup") == 1
    finally:
        scheduler._scheduler = original_scheduler


def test_stop_scheduler_clears_global_instance() -> None:
    original_scheduler = scheduler._scheduler

    class FakeScheduler:
        def __init__(self) -> None:
            self.running = True
            self.shutdown_calls = 0

        def shutdown(self, wait: bool = False) -> None:
            self.shutdown_calls += 1
            self.running = False

    fake = FakeScheduler()
    try:
        scheduler._scheduler = fake
        scheduler.stop_scheduler()

        assert fake.shutdown_calls == 1
        assert scheduler._scheduler is None
    finally:
        scheduler._scheduler = original_scheduler


def _make_sync_mocks(feeds, sync_results=None):
    """Build mock svc, feeds list, and sync results for _sync_peer_feeds tests."""
    if sync_results is None:
        sync_results = {}

    def list_feeds():
        return feeds

    def sync_feed(feed_id):
        r = sync_results.get(feed_id)
        if callable(r):
            return r()
        if isinstance(r, Exception):
            raise r
        return r

    svc = SimpleNamespace(list_feeds=list_feeds, sync_feed=sync_feed)
    return svc


def _patch_sync_dependencies(monkeypatch, svc):
    monkeypatch.setattr(
        "app.domains.calendar_sharing.service.CalendarSharingService",
        lambda *_a, **_k: svc,
    )
    monkeypatch.setattr(
        "app.domains.calendar_sharing.repository.CalendarSharingRepository",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(
        "app.core.config.get_settings",
        lambda: SimpleNamespace(db_path=":memory:"),
    )


def test_sync_peer_feeds_skips_backed_off_feed(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        feed = SimpleNamespace(id="feed-1")
        scheduler._feed_backoff["feed-1"] = time.time() + 3600
        scheduler._feed_backoff_duration["feed-1"] = 60.0

        svc = _make_sync_mocks([feed], {"feed-1": SimpleNamespace(status="ok", events_imported=0)})

        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        # Feed should still be in backoff (not cleared because it was skipped)
        assert "feed-1" in scheduler._feed_backoff
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original


def test_sync_peer_feeds_success_clears_backoff(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        feed = SimpleNamespace(id="feed-1")
        scheduler._feed_backoff["feed-1"] = time.time() - 100
        scheduler._feed_backoff_duration["feed-1"] = 120.0

        result = SimpleNamespace(status="ok", events_imported=5)
        svc = _make_sync_mocks([feed], {"feed-1": result})

        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        assert "feed-1" not in scheduler._feed_backoff
        assert "feed-1" not in scheduler._feed_backoff_duration
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original


def test_sync_peer_feeds_failure_sets_initial_backoff_60s(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        feed = SimpleNamespace(id="feed-1")
        result = SimpleNamespace(status="error", events_imported=0)
        svc = _make_sync_mocks([feed], {"feed-1": result})

        now = 1000000.0
        monkeypatch.setattr(scheduler.time, "time", lambda: now)
        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        assert scheduler._feed_backoff["feed-1"] == pytest.approx(now + 60.0)
        assert scheduler._feed_backoff_duration["feed-1"] == 60.0
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original


def test_sync_peer_feeds_failure_doubles_backoff(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        feed = SimpleNamespace(id="feed-1")
        # Existing backoff of 60s, now expired
        now = 1000000.0
        scheduler._feed_backoff["feed-1"] = now - 100
        scheduler._feed_backoff_duration["feed-1"] = 60.0

        result = SimpleNamespace(status="error", events_imported=0)
        svc = _make_sync_mocks([feed], {"feed-1": result})

        monkeypatch.setattr(scheduler.time, "time", lambda: now)
        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        assert scheduler._feed_backoff["feed-1"] == pytest.approx(now + 120.0)
        assert scheduler._feed_backoff_duration["feed-1"] == 120.0
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original


def test_sync_peer_feeds_backoff_caps_at_7200(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        feed = SimpleNamespace(id="feed-1")
        now = 1000000.0
        scheduler._feed_backoff["feed-1"] = now - 100
        scheduler._feed_backoff_duration["feed-1"] = 7200.0

        result = SimpleNamespace(status="error", events_imported=0)
        svc = _make_sync_mocks([feed], {"feed-1": result})

        monkeypatch.setattr(scheduler.time, "time", lambda: now)
        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        assert scheduler._feed_backoff["feed-1"] == pytest.approx(now + 7200.0)
        assert scheduler._feed_backoff_duration["feed-1"] == 7200.0
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original


def test_sync_peer_feeds_exception_sets_backoff(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        feed = SimpleNamespace(id="feed-1")
        svc = _make_sync_mocks([feed], {"feed-1": RuntimeError("boom")})

        now = 1000000.0
        monkeypatch.setattr(scheduler.time, "time", lambda: now)
        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        assert scheduler._feed_backoff["feed-1"] == pytest.approx(now + 60.0)
        assert scheduler._feed_backoff_duration["feed-1"] == 60.0
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original


def test_sync_peer_feeds_handles_multiple_feeds_independently(monkeypatch):
    backoff_original = scheduler._feed_backoff.copy()
    duration_original = scheduler._feed_backoff_duration.copy()
    try:
        scheduler._feed_backoff.clear()
        scheduler._feed_backoff_duration.clear()

        now = 1000000.0
        # feed-a is backed off
        feed_a = SimpleNamespace(id="feed-a")
        scheduler._feed_backoff["feed-a"] = now + 3600
        scheduler._feed_backoff_duration["feed-a"] = 120.0

        # feed-b is not backed off, succeeds
        feed_b = SimpleNamespace(id="feed-b")

        # feed-c is not backed off, fails
        feed_c = SimpleNamespace(id="feed-c")

        svc = _make_sync_mocks(
            [feed_a, feed_b, feed_c],
            {
                "feed-b": SimpleNamespace(status="ok", events_imported=3),
                "feed-c": SimpleNamespace(status="error", events_imported=0),
            },
        )

        monkeypatch.setattr(scheduler.time, "time", lambda: now)
        _patch_sync_dependencies(monkeypatch, svc)

        scheduler._sync_peer_feeds()

        # feed-a still backed off (skipped)
        assert "feed-a" in scheduler._feed_backoff
        assert scheduler._feed_backoff_duration["feed-a"] == 120.0
        # feed-b cleared (success)
        assert "feed-b" not in scheduler._feed_backoff
        # feed-c has new backoff (failure)
        assert scheduler._feed_backoff["feed-c"] == pytest.approx(now + 60.0)
        assert scheduler._feed_backoff_duration["feed-c"] == 60.0
    finally:
        scheduler._feed_backoff = backoff_original
        scheduler._feed_backoff_duration = duration_original
