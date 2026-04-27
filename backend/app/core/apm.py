"""APM (Application Performance Monitoring) integration."""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

import psutil

logger = logging.getLogger("dopaflow.apm")


class APMMetrics:
    """Custom APM metrics collector."""

    def __init__(self):
        self._custom_metrics: dict[str, float] = {}
        self._counters: dict[str, int] = {}
        self._histograms: dict[str, list[float]] = {}

    def gauge(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        """Record a gauge metric."""
        key = self._format_key(name, tags)
        self._custom_metrics[key] = value

    def counter(self, name: str, value: int = 1, tags: dict[str, str] | None = None) -> None:
        """Increment a counter metric."""
        key = self._format_key(name, tags)
        self._counters[key] = self._counters.get(key, 0) + value

    def histogram(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        """Record a histogram value."""
        key = self._format_key(name, tags)
        if key not in self._histograms:
            self._histograms[key] = []
        self._histograms[key].append(value)

    def _format_key(self, name: str, tags: dict[str, str] | None) -> str:
        """Format metric key with tags."""
        if tags:
            tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
            return f"{name}[{tag_str}]"
        return name

    def get_metrics(self) -> dict[str, Any]:
        """Get all custom metrics."""
        return {
            "gauges": self._custom_metrics.copy(),
            "counters": self._counters.copy(),
            "histograms": {
                k: {
                    "count": len(v),
                    "min": min(v) if v else 0,
                    "max": max(v) if v else 0,
                    "avg": sum(v) / len(v) if v else 0,
                    "p95": sorted(v)[int(len(v) * 0.95)] if v else 0,
                }
                for k, v in self._histograms.items()
            },
        }


class APMMonitor:
    """APM monitoring integration."""

    def __init__(self):
        self.enabled = bool(os.getenv("DOPAFLOW_APM_ENABLED", "false").lower() == "true")
        self.service_name = os.getenv("DOPAFLOW_APM_SERVICE", "dopaflow")
        self.environment = os.getenv("ENVIRONMENT", "production")
        self.metrics = APMMetrics()
        self._process = psutil.Process()

    def record_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        user_id: str | None = None,
    ) -> None:
        """Record HTTP request metrics."""
        if not self.enabled:
            return

        tags = {"method": method, "path": path, "status": str(status_code)}
        if user_id:
            tags["user"] = user_id

        self.metrics.counter("http.requests", tags=tags)
        self.metrics.histogram("http.request.duration_ms", duration_ms, tags=tags)

        # Error tracking
        if status_code >= 500:
            self.metrics.counter("http.errors.server", tags=tags)
        elif status_code >= 400:
            self.metrics.counter("http.errors.client", tags=tags)

    def record_db_query(
        self,
        operation: str,
        table: str,
        duration_ms: float,
        rows_affected: int = 0,
    ) -> None:
        """Record database query metrics."""
        if not self.enabled:
            return

        tags = {"operation": operation, "table": table}
        self.metrics.counter("db.queries", tags=tags)
        self.metrics.histogram("db.query.duration_ms", duration_ms, tags=tags)
        self.metrics.gauge("db.query.rows_affected", float(rows_affected), tags=tags)

    def record_cache_operation(
        self,
        operation: str,  # hit, miss, set, delete
        cache_name: str,
        duration_ms: float | None = None,
    ) -> None:
        """Record cache operation metrics."""
        if not self.enabled:
            return

        tags = {"operation": operation, "cache": cache_name}
        self.metrics.counter("cache.operations", tags=tags)
        if duration_ms:
            self.metrics.histogram("cache.operation.duration_ms", duration_ms, tags=tags)

    def record_background_job(
        self,
        job_name: str,
        status: str,  # started, completed, failed
        duration_ms: float | None = None,
    ) -> None:
        """Record background job metrics."""
        if not self.enabled:
            return

        tags = {"job": job_name, "status": status}
        self.metrics.counter("background.jobs", tags=tags)
        if duration_ms:
            self.metrics.histogram("background.job.duration_ms", duration_ms, tags=tags)

    def get_system_metrics(self) -> dict[str, Any]:
        """Get system resource metrics."""
        memory = self._process.memory_info()
        cpu_percent = self._process.cpu_percent()

        return {
            "memory": {
                "rss_mb": memory.rss / 1024 / 1024,
                "vms_mb": memory.vms / 1024 / 1024,
                "percent": psutil.virtual_memory().percent,
            },
            "cpu": {
                "percent": cpu_percent,
                "count": psutil.cpu_count(),
            },
            "disk": {
                "usage_percent": psutil.disk_usage("/").percent,
            },
            "connections": len(self._process.connections()),
            "threads": self._process.num_threads(),
        }

    def get_all_metrics(self) -> dict[str, Any]:
        """Get all metrics for export."""
        return {
            "service": self.service_name,
            "environment": self.environment,
            "timestamp": time.time(),
            "custom": self.metrics.get_metrics(),
            "system": self.get_system_metrics(),
        }


# Global instance
_apm: APMMonitor | None = None


def get_apm() -> APMMonitor:
    """Get or create global APM monitor."""
    global _apm
    if _apm is None:
        _apm = APMMonitor()
    return _apm


@contextmanager
def timed_operation(operation_name: str, tags: dict[str, str] | None = None):
    """Context manager to time operations."""
    start = time.time()
    try:
        yield
    finally:
        duration_ms = (time.time() - start) * 1000
        apm = get_apm()
        apm.metrics.histogram("operation.duration_ms", duration_ms, tags={"name": operation_name, **(tags or {})})


def apm_traced(operation_name: str | None = None):
    """Decorator to trace function execution with APM."""

    def decorator(func: Callable) -> Callable:
        import functools

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            name = operation_name or func.__name__
            with timed_operation(name):
                return func(*args, **kwargs)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            name = operation_name or func.__name__
            with timed_operation(name):
                return await func(*args, **kwargs)

        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return wrapper

    return decorator
