"""Write DopaFlow tasks to Obsidian-compatible Markdown files.

Task collection format (one file per project or inbox):

    ---
    dopaflow_type: task_collection
    dopaflow_project_id: prj_abc123   (omitted for inbox)
    dopaflow_scope: inbox             (for unprojectd tasks)
    project: My Project
    synced_at: 2026-04-05
    ---

    ## My Project

    - [ ] Write docs <!--df:tsk_123 due:2026-04-10 p:2 #writing-->
    - [x] Ship build <!--df:tsk_456 p:3-->

Identity anchors use HTML comments, invisible in Obsidian preview but
machine-readable on pull.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.domains.vault_bridge.file_names import slugify
from app.domains.vault_bridge.frontmatter import serialize_frontmatter
from app.domains.vault_bridge.schemas import VaultConfig


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def render_task_line(task: dict[str, Any]) -> str:
    """Render a single task as an Obsidian-compatible checkbox line.

    Format: `- [x] Title <!--df:tsk_123 due:2026-04-10 p:2 #tag-->`

    The HTML comment is hidden in Obsidian preview. It carries the DopaFlow
    identity and metadata needed for a lossless pull round-trip.
    """
    check = "x" if task.get("done") or task.get("status") == "done" else " "
    title = (task.get("title") or "").strip()

    meta_parts: list[str] = [f"df:{task['id']}"]

    due = task.get("due_at")
    if due:
        # Extract date portion only
        due_date = due[:10] if len(due) >= 10 else due
        meta_parts.append(f"due:{due_date}")

    priority = task.get("priority", 3)
    if priority != 3:
        meta_parts.append(f"p:{priority}")

    tags = task.get("tags") or []
    if tags:
        tag_str = " ".join(f"#{t}" for t in tags)
        meta_parts.append(tag_str)

    comment = "<!--" + " ".join(meta_parts) + "-->"
    return f"- [{check}] {title} {comment}"


def render_task_collection(
    tasks: list[dict[str, Any]],
    project_name: str,
    project_id: str | None = None,
    scope: str | None = None,
) -> str:
    """Render a list of tasks as a complete Markdown task-collection file."""
    fields: dict[str, Any] = {
        "dopaflow_type": "task_collection",
        "synced_at": _today_iso(),
    }
    if project_id:
        fields["dopaflow_project_id"] = project_id
    if scope:
        fields["dopaflow_scope"] = scope
    fields["project"] = project_name

    fm = serialize_frontmatter(fields)
    heading = f"## {project_name}"
    lines = [render_task_line(t) for t in tasks]
    body = "\n".join(lines) if lines else "_No tasks._"
    return fm + "\n\n" + heading + "\n\n" + body + "\n"


def render_tasks_section(tasks: list[dict[str, Any]]) -> str:
    """Render a compact tasks block for injection into a daily note section.

    Returns just the task lines (no frontmatter, no heading).
    """
    if not tasks:
        return "_No tasks for today._"
    return "\n".join(render_task_line(t) for t in tasks)


def _collection_path(config: VaultConfig, slug: str) -> tuple[str, Path]:
    """Return (rel_path, abs_path) for a task collection file."""
    rel_path = f"{config.tasks_folder}/{slug}.md"
    abs_path = Path(config.vault_path) / rel_path
    return rel_path, abs_path


def rewrite_task_id_in_file(
    abs_path: Path,
    original_line: str,
    new_id: str,
    *,
    line_number: int | None = None,
) -> bool:
    """Find a task line by its original text and add the DopaFlow ID to its comment.

    Searches for the first line in the file that matches ``original_line`` (stripped),
    then replaces it with a version that carries ``<!--df:<new_id>-->``.

    Returns True if the line was found and updated, False otherwise.
    Does not raise — silently returns False on any file error.
    """
    try:
        content = abs_path.read_text(encoding="utf-8")
        lines = content.split("\n")
        target = original_line.strip()

        for i, line in enumerate(lines, start=1):
            if line_number is not None and i != line_number:
                continue
            if line.strip() == target:
                # Inject df: into existing comment or append a new one
                if "<!--" in line and "-->" in line:
                    # Already has a comment — insert df: at start of comment content
                    lines[i - 1] = re.sub(
                        r"<!--",
                        f"<!--df:{new_id} ",
                        line,
                        count=1,
                    )
                else:
                    lines[i - 1] = line.rstrip() + f" <!--df:{new_id}-->"
                abs_path.write_text("\n".join(lines), encoding="utf-8")
                return True
    except Exception:
        pass
    return False


def write_task_collection(
    tasks: list[dict[str, Any]],
    slug: str,
    project_name: str,
    config: VaultConfig,
    project_id: str | None = None,
    scope: str | None = None,
) -> tuple[str, str, str | None]:
    """Write a task collection file to the vault.

    Returns (file_path_relative, content_hash, previous_content_or_None).
    Raises ValueError / FileNotFoundError on bad config.
    """
    if not config.vault_path:
        raise ValueError("vault_path is not configured")

    vault_root = Path(config.vault_path)
    if not vault_root.exists():
        raise FileNotFoundError(f"Vault path does not exist: {config.vault_path}")

    rel_path, abs_path = _collection_path(config, slug)
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    previous: str | None = None
    if abs_path.exists():
        previous = abs_path.read_text(encoding="utf-8")

    content = render_task_collection(tasks, project_name, project_id=project_id, scope=scope)
    abs_path.write_text(content, encoding="utf-8")
    return rel_path, _hash(content), previous
