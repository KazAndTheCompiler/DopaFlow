"""Schemas for player routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PlayerResolveUrlRequest(BaseModel):
    """Payload for resolving a playable stream URL."""

    url: str


class PlayerResolveUrlResponse(BaseModel):
    """Result of resolving a stream URL."""

    stream_url: str | None = None
    error: str | None = None


class PlayerQueueItem(BaseModel):
    """Queued player item."""

    url: str


class PlayerQueueRequest(BaseModel):
    """Payload for replacing the current queue."""

    items: list[dict[str, object] | str] = Field(default_factory=list)


class PlayerQueueResponse(BaseModel):
    """Current queue state."""

    items: list[str]
    count: int


class PlayerNextTrackResponse(BaseModel):
    """Result of moving to the next queued track."""

    item: str | None = None
    remaining: int


class PlayerPredownloadJob(BaseModel):
    """Predownload queue job."""

    id: str
    status: str
    url: str | None = None
    title: str | None = None
    error: str | None = None
    filepath: str | None = None


class PlayerPredownloadJobResponse(BaseModel):
    """Single predownload job wrapper."""

    job: dict[str, object]


class PlayerPredownloadStatusResponse(BaseModel):
    """Predownload queue status."""

    jobs: list[dict[str, object]]
    count: int


class PlayerPredownloadTickResponse(BaseModel):
    """Progression tick result for a predownload job."""

    job: dict[str, object]
    progression: list[str]
