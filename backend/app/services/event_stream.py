"""In-process server-sent event broadcasting for UI invalidations."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Literal, TypedDict

from fastapi import Request


class InvalidationEvent(TypedDict):
    type: Literal["invalidate"]
    domain: str


class EventStreamBroker:
    """Fan out small invalidation events to active SSE subscribers."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[InvalidationEvent]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[InvalidationEvent]:
        queue: asyncio.Queue[InvalidationEvent] = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[InvalidationEvent]) -> None:
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, event: InvalidationEvent) -> None:
        async with self._lock:
            subscribers = list(self._subscribers)
        for queue in subscribers:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                continue


broker = EventStreamBroker()


async def publish_invalidation(domain: str) -> None:
    await broker.publish({"type": "invalidate", "domain": domain})


async def stream_events(request: Request) -> AsyncIterator[dict[str, str]]:
    queue = await broker.subscribe()
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=15.0)
            except TimeoutError:
                yield {"comment": "ping"}
                continue
            yield {"data": json.dumps(payload)}
    finally:
        await broker.unsubscribe(queue)
