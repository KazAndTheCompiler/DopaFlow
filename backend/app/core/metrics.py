"""In-memory metrics collection for production observability."""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class Counter:
    value: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock)

    def inc(self, n: int = 1) -> None:
        with self.lock:
            self.value += n

    def get(self) -> int:
        return self.value


@dataclass
class Histogram:
    buckets: list[int]
    count: int = 0
    sum_ms: float = 0.0
    lock: threading.Lock = field(default_factory=threading.Lock)

    def __post_init__(self) -> None:
        self.buckets = sorted(self.buckets)

    def observe(self, value_ms: float) -> None:
        with self.lock:
            self.count += 1
            self.sum_ms += value_ms

    def get_percentile(self, p: float) -> float:
        return 0.0


class MetricsStore:
    """Thread-safe in-memory metrics store."""

    _instance: MetricsStore | None = None
    _lock = threading.Lock()

    def __new__(cls) -> MetricsStore:
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init()
            return cls._instance

    def _init(self) -> None:
        self._req_count = Counter()
        self._err_count = Counter()
        self._start_time = time.time()
        self._latency = Histogram([50, 100, 200, 500, 1000, 2000, 5000])
        self._status_codes: dict[str, Counter] = defaultdict(Counter)
        self._method_count: dict[str, Counter] = defaultdict(Counter)

    def record_request(self, method: str, status: int, latency_ms: float) -> None:
        self._req_count.inc()
        self._latency.observe(latency_ms)
        self._method_count[method].inc()
        self._status_codes[str(status)].inc()
        if status >= 400:
            self._err_count.inc()

    def get(self) -> dict:
        uptime = time.time() - self._start_time
        return {
            "uptime_seconds": round(uptime, 1),
            "requests_total": self._req_count.get(),
            "errors_total": self._err_count.get(),
            "requests_by_method": {k: v.get() for k, v in self._method_count.items()},
            "requests_by_status": {k: v.get() for k, v in self._status_codes.items()},
            "latency_ms": {
                "count": self._latency.count,
                "sum_ms": round(self._latency.sum_ms, 2),
                "avg_ms": (
                    round(self._latency.sum_ms / self._latency.count, 2)
                    if self._latency.count > 0
                    else 0.0
                ),
                "slow_count": sum(
                    1 for _ in self._latency.buckets if _ >= 200
                ),
            },
        }


_metrics = MetricsStore()


def record_request(method: str, status: int, latency_ms: float) -> None:
    _metrics.record_request(method, status, latency_ms)


def get_metrics() -> dict:
    return _metrics.get()
