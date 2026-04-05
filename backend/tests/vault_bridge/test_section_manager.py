"""Tests for the bounded section manager."""

import pytest
from app.domains.vault_bridge.section_manager import (
    extract_section,
    inject_section,
    remove_section,
)

SECTION_ID = "tasks"
START = "<!-- dopaflow:tasks:start -->"
END = "<!-- dopaflow:tasks:end -->"


class TestInjectSection:
    def test_appends_when_no_markers(self):
        existing = "# Daily Note\n\nSome journal content.\n"
        result = inject_section(existing, SECTION_ID, "- [ ] Task A")
        assert START in result
        assert END in result
        assert "- [ ] Task A" in result
        # Original content preserved before section
        assert "# Daily Note" in result
        assert "Some journal content." in result

    def test_appends_after_existing_content(self):
        existing = "Hello world"
        result = inject_section(existing, SECTION_ID, "new section")
        idx_hello = result.index("Hello world")
        idx_start = result.index(START)
        assert idx_hello < idx_start

    def test_replaces_existing_section(self):
        existing = f"Before\n\n{START}\nold content\n{END}\nAfter\n"
        result = inject_section(existing, SECTION_ID, "new content")
        assert "old content" not in result
        assert "new content" in result
        assert "Before" in result
        assert "After" in result

    def test_idempotent_on_same_content(self):
        existing = "Header\n"
        once = inject_section(existing, SECTION_ID, "body")
        twice = inject_section(once, SECTION_ID, "body")
        # Should only have one start marker
        assert twice.count(START) == 1
        assert twice.count(END) == 1

    def test_replaces_different_section_id(self):
        start_a = "<!-- dopaflow:alpha:start -->"
        end_a = "<!-- dopaflow:alpha:end -->"
        start_b = "<!-- dopaflow:beta:start -->"
        end_b = "<!-- dopaflow:beta:end -->"
        existing = f"{start_a}\nalpha content\n{end_a}\n"
        result = inject_section(existing, "beta", "beta content")
        assert "alpha content" in result
        assert "beta content" in result
        assert start_b in result
        assert end_b in result

    def test_body_is_stripped_of_extra_newlines(self):
        result = inject_section("", SECTION_ID, "\n\nbody\n\n")
        # Should not double-blank-line the body
        assert "body" in result
        assert "\n\n\n" not in result

    def test_preserves_user_content_between_sections(self):
        """User text after journal body but before task section is preserved."""
        existing = "Journal body\n\nUser note in Obsidian.\n"
        result = inject_section(existing, SECTION_ID, "- [ ] Task")
        assert "User note in Obsidian." in result
        assert "- [ ] Task" in result


class TestExtractSection:
    def test_returns_none_when_no_markers(self):
        assert extract_section("No markers here", SECTION_ID) is None

    def test_returns_body_between_markers(self):
        content = f"Before\n{START}\nmy section body\n{END}\nAfter"
        result = extract_section(content, SECTION_ID)
        assert result == "my section body"

    def test_strips_whitespace(self):
        content = f"{START}\n\n  body  \n\n{END}"
        result = extract_section(content, SECTION_ID)
        assert result == "body"

    def test_multiline_body(self):
        body = "- [ ] Task A\n- [x] Task B"
        content = f"{START}\n{body}\n{END}"
        result = extract_section(content, SECTION_ID)
        assert result == body


class TestRemoveSection:
    def test_removes_section_and_markers(self):
        content = f"Before\n\n{START}\nbody\n{END}\nAfter\n"
        result = remove_section(content, SECTION_ID)
        assert START not in result
        assert END not in result
        assert "body" not in result
        assert "Before" in result
        assert "After" in result

    def test_noop_when_no_markers(self):
        content = "No markers here.\n"
        result = remove_section(content, SECTION_ID)
        assert result == content
