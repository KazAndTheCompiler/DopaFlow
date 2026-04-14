"""Pure task-to-quadrant helpers."""

from __future__ import annotations


def quadrant(priority: int) -> str:
    """Map priority 1-4 to Eisenhower quadrant label."""
    return {1: "do", 2: "schedule", 3: "delegate", 4: "eliminate"}.get(
        priority, "eliminate"
    )


def sort_into_quadrants(tasks: list[dict]) -> dict[str, list[dict]]:
    """Split a task list into the four quadrants. Skips done tasks."""
    out: dict[str, list[dict]] = {
        "do": [],
        "schedule": [],
        "delegate": [],
        "eliminate": [],
    }
    for task in tasks:
        if task.get("done"):
            continue
        out[quadrant(int(task.get("priority", 4)))].append(task)
    return out
