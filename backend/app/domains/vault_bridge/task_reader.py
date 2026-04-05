"""Read Obsidian-compatible task Markdown files and parse them into DopaFlow task candidates."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from app.domains.vault_bridge.frontmatter import deserialize_frontmatter

# Matches: - [ ] Title <!--df:tsk_123 due:2026-04-10 p:2 #tag1 #tag2-->
_TASK_LINE_RE = re.compile(
    r"^- \[(?P<check>[xX ])\] (?P<title>.+?)(?:\s+<!--(?P<meta>[^>]*)-->)?\s*$"
)
_DF_ID_RE = re.compile(r"df:([\w_]+)")
_DUE_RE = re.compile(r"due:(\d{4}-\d{2}-\d{2})")
_PRIORITY_RE = re.compile(r"p:([123])")
_TAG_RE = re.compile(r"#([\w-]+)")


@dataclass
class TaskCandidate:
    """Parsed task data from a vault file, not yet committed to DB."""

    file_path: str                       # relative to vault root
    title: str
    done: bool
    dopaflow_id: str | None = None
    due_str: str | None = None           # ISO date string or None
    priority: int = 3
    tags: list[str] = field(default_factory=list)
    project_id: str | None = None        # from file frontmatter
    project_name: str | None = None      # from file frontmatter
    line_text: str = ""                  # original raw line (for ID rewrite on import)
    line_number: int | None = None


def parse_task_line(
    line: str,
    file_path: str = "",
    project_id: str | None = None,
    project_name: str | None = None,
    raw_line: str = "",
    line_number: int | None = None,
) -> TaskCandidate | None:
    """Parse a single task checkbox line.

    Returns None if the line is not a valid task checkbox.
    """
    m = _TASK_LINE_RE.match(line.strip())
    if not m:
        return None

    done = m.group("check").lower() == "x"
    raw_title = m.group("title").strip()
    meta = m.group("meta") or ""

    # Strip the meta comment from title if it accidentally bleeds in
    title = re.sub(r"\s*<!--[^>]*-->\s*$", "", raw_title).strip()

    dopaflow_id: str | None = None
    id_match = _DF_ID_RE.search(meta)
    if id_match:
        dopaflow_id = id_match.group(1)

    due_str: str | None = None
    due_match = _DUE_RE.search(meta)
    if due_match:
        due_str = due_match.group(1)

    priority = 3
    p_match = _PRIORITY_RE.search(meta)
    if p_match:
        priority = int(p_match.group(1))

    tags = _TAG_RE.findall(meta)

    return TaskCandidate(
        file_path=file_path,
        title=title,
        done=done,
        dopaflow_id=dopaflow_id,
        due_str=due_str,
        priority=priority,
        tags=tags,
        project_id=project_id,
        project_name=project_name,
        line_text=raw_line or line.strip(),
        line_number=line_number,
    )


def parse_task_collection(abs_path: Path, vault_root: Path) -> list[TaskCandidate]:
    """Parse all task lines from a task collection file.

    Reads frontmatter for project identity, then extracts all checkbox lines.
    """
    content = abs_path.read_text(encoding="utf-8")
    fields, body = deserialize_frontmatter(content)

    # Only process files DopaFlow created
    if fields.get("dopaflow_type") != "task_collection":
        return []

    project_id = fields.get("dopaflow_project_id")
    project_name = fields.get("project")
    file_path = str(abs_path.relative_to(vault_root))
    body_start_line = 1
    full_lines = content.splitlines()
    if full_lines and full_lines[0] == "---":
        for idx, line in enumerate(full_lines[1:], start=2):
            if line == "---":
                body_start_line = idx + 1
                break

    candidates = []
    for body_offset, line in enumerate(body.splitlines(), start=0):
        candidate = parse_task_line(
            line,
            file_path=file_path,
            project_id=project_id,
            project_name=project_name,
            raw_line=line,
            line_number=body_start_line + body_offset,
        )
        if candidate is not None:
            candidates.append(candidate)

    return candidates


def scan_task_collections(vault_root: Path, tasks_folder: str) -> list[TaskCandidate]:
    """Scan the tasks folder and return all parsed task candidates."""
    tasks_dir = vault_root / tasks_folder
    if not tasks_dir.exists():
        return []

    all_candidates: list[TaskCandidate] = []
    for md_file in sorted(tasks_dir.glob("*.md")):
        try:
            candidates = parse_task_collection(md_file, vault_root)
            all_candidates.extend(candidates)
        except Exception:
            pass  # skip unreadable files

    return all_candidates
