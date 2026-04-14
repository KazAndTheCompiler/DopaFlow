"""Tests for the frontmatter serializer and deserializer."""

from __future__ import annotations

from app.domains.vault_bridge.frontmatter import (
    deserialize_frontmatter,
    serialize_frontmatter,
)


class TestSerializeFrontmatter:
    """Tests for serialize_frontmatter function."""

    def test_round_trip_preserves_fields_and_body(self) -> None:
        """Serialize then deserialize returns same fields and body."""
        original_fields = {
            "dopaflow_type": "journal",
            "dopaflow_id": "jrn_abc123",
            "date": "2026-04-05",
            "tags": ["work", "deep"],
        }
        original_body = "This is the journal entry content.\nWith multiple lines."

        # Serialize
        serialized = serialize_frontmatter(original_fields)
        serialized_with_body = serialized + "\n" + original_body

        # Deserialize
        parsed_fields, parsed_body = deserialize_frontmatter(serialized_with_body)

        assert parsed_fields == original_fields
        assert parsed_body == original_body

    def test_none_values_are_excluded(self) -> None:
        """Fields with None values are skipped in serialized output."""
        fields = {
            "title": "Test",
            "author": None,
            "tags": ["a", "b"],
            "empty_field": None,
        }

        serialized = serialize_frontmatter(fields)

        assert "author:" not in serialized
        assert "empty_field:" not in serialized
        assert "title: Test" in serialized
        assert "tags:" in serialized

    def test_list_fields_serialize_correctly(self) -> None:
        """List values are written as YAML sequence lines."""
        fields = {"tags": ["work", "personal", "urgent"]}

        serialized = serialize_frontmatter(fields)

        assert "tags:" in serialized
        assert "  - work" in serialized
        assert "  - personal" in serialized
        assert "  - urgent" in serialized

    def test_string_with_colon_is_quoted(self) -> None:
        """String values containing colons are quoted."""
        fields = {"title": "Work: Deep Focus Session"}

        serialized = serialize_frontmatter(fields)

        assert 'title: "Work: Deep Focus Session"' in serialized

    def test_output_includes_delimiters(self) -> None:
        """Output includes both opening and closing --- delimiters."""
        fields = {"test": "value"}

        serialized = serialize_frontmatter(fields)

        lines = serialized.split("\n")
        assert lines[0] == "---"
        assert lines[-1] == "---"

    def test_empty_dict_produces_minimal_frontmatter(self) -> None:
        """Serializing empty dict produces just the delimiters."""
        serialized = serialize_frontmatter({})

        assert serialized == "---\n---"

    def test_multiple_fields_serialize_in_order(self) -> None:
        """Multiple fields are serialized in iteration order."""
        fields = {
            "dopaflow_type": "journal",
            "date": "2026-04-05",
            "title": "Daily Note",
        }

        serialized = serialize_frontmatter(fields)

        lines = [line for line in serialized.split("\n") if line and line != "---"]
        # All three fields should be present
        assert len(lines) == 3
        assert "dopaflow_type:" in serialized
        assert "date:" in serialized
        assert "title:" in serialized


class TestDeserializeFrontmatter:
    """Tests for deserialize_frontmatter function."""

    def test_text_with_no_frontmatter_returns_empty_dict(self) -> None:
        """Text without frontmatter block returns empty dict and original text."""
        text = "Just some regular markdown content.\nNo frontmatter here."

        fields, body = deserialize_frontmatter(text)

        assert fields == {}
        assert body == text

    def test_frontmatter_is_separated_from_body(self) -> None:
        """Frontmatter block is correctly separated from body."""
        text = """---
title: Test Note
date: 2026-04-05
---
This is the body content.
Multiple lines here."""

        fields, body = deserialize_frontmatter(text)

        assert fields == {"title": "Test Note", "date": "2026-04-05"}
        assert body == "This is the body content.\nMultiple lines here."

    def test_list_values_parse_back_to_lists(self) -> None:
        """List fields are parsed back to Python lists."""
        text = """---
tags:
  - work
  - deep
  - focus
---
Body content"""

        fields, body = deserialize_frontmatter(text)

        assert fields["tags"] == ["work", "deep", "focus"]
        assert isinstance(fields["tags"], list)

    def test_bare_strings_parse_to_str(self) -> None:
        """String values remain as strings."""
        text = """---
title: My Journal Entry
date: 2026-04-05
---
Body"""

        fields, body = deserialize_frontmatter(text)

        assert fields["title"] == "My Journal Entry"
        assert fields["date"] == "2026-04-05"
        assert isinstance(fields["title"], str)

    def test_quoted_values_have_quotes_removed(self) -> None:
        """Quoted string values have quotes stripped."""
        text = """---
title: "Work: Deep Session"
author: "Jane Doe"
---
Body"""

        fields, body = deserialize_frontmatter(text)

        assert fields["title"] == "Work: Deep Session"
        assert fields["author"] == "Jane Doe"

    def test_body_after_frontmatter_is_preserved_exactly(self) -> None:
        """Body content is returned exactly with preserved formatting."""
        text = """---
title: Note
---
First line
  Indented line
Empty line below

Final line"""

        fields, body = deserialize_frontmatter(text)

        expected_body = "First line\n  Indented line\nEmpty line below\n\nFinal line"
        assert body == expected_body

    def test_no_closing_delimiter_returns_no_frontmatter(self) -> None:
        """If closing --- is missing, treat entire text as body."""
        text = """---
title: Test
No closing delimiter here
Just content"""

        fields, body = deserialize_frontmatter(text)

        assert fields == {}
        assert body == text

    def test_empty_frontmatter_block(self) -> None:
        """Frontmatter block with no fields returns empty dict."""
        text = """---
---
Body content"""

        fields, body = deserialize_frontmatter(text)

        assert fields == {}
        assert body == "Body content"

    def test_complex_roundtrip(self) -> None:
        """Complex document with multiple field types round-trips correctly."""
        original_fields = {
            "dopaflow_type": "journal",
            "dopaflow_id": "jrn_xyz789",
            "date": "2026-04-05",
            "tags": ["work", "deep-work", "focus"],
            "title": "Daily Deep Work Session",
            "mood": "energized",
        }
        original_body = """Today was a productive day.

Key accomplishments:
- Completed the report
- Reviewed code changes
- Updated documentation

Next steps: Deploy to staging."""

        # Serialize
        serialized = serialize_frontmatter(original_fields)
        full_text = serialized + "\n" + original_body

        # Deserialize
        parsed_fields, parsed_body = deserialize_frontmatter(full_text)

        assert parsed_fields == original_fields
        assert parsed_body == original_body

    def test_list_with_single_item(self) -> None:
        """List with single item parses correctly."""
        text = """---
tags:
  - solo
---
Body"""

        fields, body = deserialize_frontmatter(text)

        assert fields["tags"] == ["solo"]

    def test_multiline_list_parsing(self) -> None:
        """Multiple list fields are parsed independently."""
        text = """---
tags:
  - work
  - focus
categories:
  - daily
  - journal
---
Body"""

        fields, body = deserialize_frontmatter(text)

        assert fields["tags"] == ["work", "focus"]
        assert fields["categories"] == ["daily", "journal"]

    def test_whitespace_handling_in_values(self) -> None:
        """Whitespace in values is preserved."""
        text = """---
title: Note with Spaces
description: This has  multiple   spaces
---
Body"""

        fields, body = deserialize_frontmatter(text)

        assert fields["title"] == "Note with Spaces"
        assert fields["description"] == "This has  multiple   spaces"
