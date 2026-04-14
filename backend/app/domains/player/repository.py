"""In-memory repository for player queue state."""

from __future__ import annotations

import uuid

_ACTIVE_STATES = {"queued", "downloading", "retry_wait"}
_TERMINAL_STATES = {"completed", "failed"}
_PROGRESS_STATES = ["queued", "downloading", "completed"]


class PlayerRepository:
    _queue: list[dict[str, object]] = []
    _jobs: list[dict[str, object]] = []

    def get_queue(self) -> list[dict[str, object]]:
        return list(self._queue)

    def save_queue(self, items: list[dict[str, object]]) -> list[dict[str, object]]:
        self._queue = list(items)
        return self.get_queue()

    def pop_next(self) -> dict[str, object] | None:
        if not self._queue:
            return None
        return self._queue.pop(0)

    def enqueue_job(self, payload: dict[str, object]) -> dict[str, object]:
        if len([j for j in self._jobs if j.get("status") in _ACTIVE_STATES]) >= 100:
            return {"status": "queue_full"}
        job = {
            "id": str(uuid.uuid4()),
            "state": "queued",
            "attempts": 0,
            "max_attempts": 5,
            **payload,
        }
        self._jobs.append(job)
        return job

    def get_job(self, job_id: str) -> dict[str, object] | None:
        for job in self._jobs:
            if job.get("id") == job_id:
                return dict(job)
        return None

    def list_jobs(self) -> list[dict[str, object]]:
        return list(self._jobs)

    def retry_job(self, job_id: str) -> dict[str, object] | None:
        for job in self._jobs:
            if job.get("id") == job_id and job.get("state") in ("failed", "retry_wait"):
                job["state"] = "queued"
                return dict(job)
        return self.get_job(job_id)

    def advance_job(self, job_id: str) -> dict[str, object] | None:
        for job in self._jobs:
            if job.get("id") == job_id:
                cur = job.get("state")
                if cur in _TERMINAL_STATES:
                    return dict(job)
                if cur == "retry_wait":
                    job["state"] = "queued"
                elif cur == "queued":
                    job["state"] = "downloading"
                else:
                    job["state"] = "completed"
                return dict(job)
        return None

    def progression_states(self) -> list[str]:
        return list(_PROGRESS_STATES)
