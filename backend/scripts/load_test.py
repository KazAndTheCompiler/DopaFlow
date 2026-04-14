#!/usr/bin/env python3
"""Simple load test for critical endpoints."""

import asyncio
import statistics
import time
from collections.abc import Coroutine
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx


def run_load_test(
    url: str,
    *,
    concurrent: int = 10,
    total_requests: int = 100,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Run a simple load test against a URL."""

    results: dict[str, Any] = {
        "url": url,
        "concurrent": concurrent,
        "total_requests": total_requests,
        "success": 0,
        "errors": 0,
        "latencies_ms": [],
        "status_codes": {},
    }

    def make_request() -> tuple[int, float]:
        start = time.perf_counter()
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.get(url)
            latency_ms = (time.perf_counter() - start) * 1000
            return response.status_code, latency_ms
        except Exception:
            latency_ms = (time.perf_counter() - start) * 1000
            return 0, latency_ms

    with ThreadPoolExecutor(max_workers=concurrent) as pool:
        futures = [pool.submit(make_request) for _ in range(total_requests)]
        for future in futures:
            status, latency_ms = future.result()
            results["latencies_ms"].append(latency_ms)
            if 200 <= status < 400:
                results["success"] += 1
            else:
                results["errors"] += 1
            results["status_codes"][status] = results["status_codes"].get(status, 0) + 1

    latencies = results["latencies_ms"]
    results["latencies_ms"] = None
    results["latency_p50_ms"] = round(statistics.median(latencies), 2)
    results["latency_p95_ms"] = round(sorted(latencies)[int(len(latencies) * 0.95)], 2)
    results["latency_p99_ms"] = round(sorted(latencies)[int(len(latencies) * 0.99)], 2)
    results["latency_avg_ms"] = round(statistics.mean(latencies), 2)
    results["latency_max_ms"] = round(max(latencies), 2)
    return results


async def run_concurrent_load_test(
    url: str,
    endpoints: list[str],
    concurrent: int = 10,
    requests_per_endpoint: int = 20,
) -> dict[str, Any]:
    """Run concurrent load test across multiple endpoints."""

    async def hit(client: httpx.AsyncClient, path: str) -> tuple[str, int, float]:
        start = time.perf_counter()
        try:
            r = await client.get(f"{url}{path}", timeout=10.0)
            return path, r.status_code, (time.perf_counter() - start) * 1000
        except Exception:
            return path, 0, (time.perf_counter() - start) * 1000

    results: dict[str, Any] = {"url": url, "endpoints": {}}

    async with httpx.AsyncClient() as client:
        tasks: list[Coroutine] = []
        for path in endpoints:
            for _ in range(requests_per_endpoint):
                tasks.append(hit(client, path))

        import random

        random.shuffle(tasks)
        outcomes = await asyncio.gather(*tasks)

    for path, status, latency_ms in outcomes:
        if path not in results["endpoints"]:
            results["endpoints"][path] = {"success": 0, "errors": 0, "latencies": []}
        ep = results["endpoints"][path]
        ep["latencies"].append(latency_ms)
        if 200 <= status < 400:
            ep["success"] += 1
        else:
            ep["errors"] += 1

    for _path, ep in results["endpoints"].items():
        latencies = ep["latencies"]
        ep["latencies"] = None
        ep["latency_avg_ms"] = round(statistics.mean(latencies), 2)
        ep["latency_p95_ms"] = round(sorted(latencies)[int(len(latencies) * 0.95)], 2)
        ep["success_rate"] = round(
            ep["success"] / (ep["success"] + ep["errors"]) * 100, 1
        )

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python load_test.py <url>")
        sys.exit(1)

    url = sys.argv[1]
    print(f"Running load test against {url}...")
    result = run_load_test(f"{url}/health/live", total_requests=50, concurrent=10)
    print(f"\nResults for {result['url']}:")
    print(f"  Success: {result['success']}/{result['total_requests']}")
    print(f"  Latency avg: {result['latency_avg_ms']}ms")
    print(f"  Latency p95: {result['latency_p95_ms']}ms")
    print(f"  Latency p99: {result['latency_p99_ms']}ms")
    print(f"  Max: {result['latency_max_ms']}ms")
    print(f"  Status codes: {result['status_codes']}")
