"""Bounded-section read/write helper for Obsidian vault files.

DopaFlow manages only clearly-owned sections, leaving user-authored content
outside the markers untouched.

Marker format:
    <!-- dopaflow:{section_id}:start -->
    ...managed content...
    <!-- dopaflow:{section_id}:end -->
"""

from __future__ import annotations


def _start_marker(section_id: str) -> str:
    return f"<!-- dopaflow:{section_id}:start -->"


def _end_marker(section_id: str) -> str:
    return f"<!-- dopaflow:{section_id}:end -->"


def inject_section(existing: str, section_id: str, new_body: str) -> str:
    """Insert or replace a bounded section inside existing file content.

    If markers are already present, replaces the content between them.
    If markers are absent, appends the section at the end of the file.

    Args:
        existing: Full current file content.
        section_id: Identifier for this section (e.g. "tasks").
        new_body: New content to place between the markers (no trailing newline needed).

    Returns:
        Updated file content with the managed section in place.
    """
    start = _start_marker(section_id)
    end = _end_marker(section_id)

    if start in existing and end in existing:
        # Replace between existing markers
        before = existing[: existing.index(start)]
        after = existing[existing.index(end) + len(end) :]
        return before + start + "\n" + new_body.strip("\n") + "\n" + end + after
    else:
        # Append at end, preceded by a blank line
        base = existing.rstrip("\n")
        return base + "\n\n" + start + "\n" + new_body.strip("\n") + "\n" + end + "\n"


def extract_section(content: str, section_id: str) -> str | None:
    """Return the body inside a bounded section, or None if markers are absent.

    Args:
        content: Full file content.
        section_id: Identifier for the section.

    Returns:
        Content between the markers (stripped), or None.
    """
    start = _start_marker(section_id)
    end = _end_marker(section_id)

    if start not in content or end not in content:
        return None

    between = content[content.index(start) + len(start) : content.index(end)]
    return between.strip()


def remove_section(existing: str, section_id: str) -> str:
    """Remove a bounded section (markers and body) from file content.

    Returns the original content unchanged if markers are not found.
    """
    start = _start_marker(section_id)
    end = _end_marker(section_id)

    if start not in existing or end not in existing:
        return existing

    before = existing[: existing.index(start)].rstrip("\n")
    after = existing[existing.index(end) + len(end) :].lstrip("\n")
    return (before + "\n" + after).rstrip("\n") + "\n"
