"""Tests for the vault file naming utility."""

from __future__ import annotations

import pytest

from app.domains.vault_bridge.file_names import (
    attachment_path,
    journal_note_path,
    project_note_path,
    review_card_path,
    slugify,
    task_inbox_path,
)


class TestJournalNotePath:
    """Tests for journal_note_path function."""

    def test_returns_correct_format_for_known_date(self) -> None:
        """journal_note_path returns correct format for a known date."""
        result = journal_note_path("2026-04-05")
        assert result == "Daily/2026-04-05.md"

    def test_handles_different_dates(self) -> None:
        """Works with various ISO date formats."""
        assert journal_note_path("2025-01-01") == "Daily/2025-01-01.md"
        assert journal_note_path("2026-12-31") == "Daily/2026-12-31.md"
        assert journal_note_path("2020-06-15") == "Daily/2020-06-15.md"

    def test_includes_md_extension(self) -> None:
        """Output includes .md extension."""
        result = journal_note_path("2026-04-05")
        assert result.endswith(".md")


class TestTaskInboxPath:
    """Tests for task_inbox_path function."""

    def test_returns_expected_path(self) -> None:
        """task_inbox_path returns Tasks/Inbox.md."""
        result = task_inbox_path()
        assert result == "Tasks/Inbox.md"


class TestProjectNotePath:
    """Tests for project_note_path function."""

    def test_returns_correct_format_with_clean_slug(self) -> None:
        """project_note_path with a clean slug."""
        result = project_note_path("my-project")
        assert result == "Projects/my-project.md"

    def test_works_with_various_slugs(self) -> None:
        """Works with different valid slugs."""
        assert project_note_path("deep-work") == "Projects/deep-work.md"
        assert project_note_path("a") == "Projects/a.md"
        assert project_note_path("project-123") == "Projects/project-123.md"

    def test_raises_for_empty_slug(self) -> None:
        """ValueError is raised for empty slug."""
        with pytest.raises(ValueError, match="slug cannot be empty"):
            project_note_path("")

    def test_raises_for_path_traversal_with_dots(self) -> None:
        """ValueError is raised for slug containing .."""
        with pytest.raises(ValueError, match="path traversal"):
            project_note_path("../evil")

    def test_raises_for_path_separator_in_slug(self) -> None:
        """ValueError is raised for slug containing / or \\."""
        with pytest.raises(ValueError, match="path separator"):
            project_note_path("project/name")

        with pytest.raises(ValueError, match="path separator"):
            project_note_path("project\\name")

    def test_includes_md_extension(self) -> None:
        """Output includes .md extension."""
        result = project_note_path("test")
        assert result.endswith(".md")


class TestReviewCardPath:
    """Tests for review_card_path function."""

    def test_returns_expected_nested_path(self) -> None:
        """review_card_path returns expected nested path."""
        result = review_card_path("spanish-vocab", "card_123")
        assert result == "Review/spanish-vocab/card_123.md"

    def test_works_with_different_decks_and_cards(self) -> None:
        """Works with various deck and card combinations."""
        assert review_card_path("math", "prob_456") == "Review/math/prob_456.md"
        assert review_card_path("french", "c1") == "Review/french/c1.md"

    def test_raises_for_empty_deck_slug(self) -> None:
        """ValueError is raised for empty deck_slug."""
        with pytest.raises(ValueError, match="slug cannot be empty"):
            review_card_path("", "card_123")

    def test_raises_for_empty_card_id(self) -> None:
        """ValueError is raised for empty card_id."""
        with pytest.raises(ValueError, match="card_id cannot be empty"):
            review_card_path("spanish", "")

    def test_raises_for_path_traversal_in_deck_slug(self) -> None:
        """ValueError is raised for deck_slug containing .."""
        with pytest.raises(ValueError, match="path traversal"):
            review_card_path("../evil", "card_123")

    def test_raises_for_path_traversal_in_card_id(self) -> None:
        """ValueError is raised for card_id containing .."""
        with pytest.raises(ValueError, match="invalid path characters"):
            review_card_path("spanish", "../evil")

    def test_raises_for_path_separator_in_card_id(self) -> None:
        """ValueError is raised for card_id containing / or \\."""
        with pytest.raises(ValueError, match="invalid path characters"):
            review_card_path("spanish", "card/id")

        with pytest.raises(ValueError, match="invalid path characters"):
            review_card_path("spanish", "card\\id")

    def test_includes_md_extension(self) -> None:
        """Output includes .md extension."""
        result = review_card_path("deck", "card")
        assert result.endswith(".md")


class TestAttachmentPath:
    """Tests for attachment_path function."""

    def test_returns_expected_path(self) -> None:
        """attachment_path returns Attachments/<filename>."""
        result = attachment_path("image.png")
        assert result == "Attachments/image.png"

    def test_works_with_various_filenames(self) -> None:
        """Works with different file types and names."""
        assert attachment_path("document.pdf") == "Attachments/document.pdf"
        assert attachment_path("video.mp4") == "Attachments/video.mp4"
        assert attachment_path("data.xlsx") == "Attachments/data.xlsx"

    def test_preserves_filename_exactly(self) -> None:
        """Filename is preserved exactly as passed."""
        result = attachment_path("My Document (1).docx")
        assert result == "Attachments/My Document (1).docx"


class TestSlugify:
    """Tests for slugify function."""

    def test_converts_display_names_correctly(self) -> None:
        """slugify converts display names to vault-safe slugs."""
        assert slugify("My Project Name") == "my-project-name"
        assert slugify("Deep Work") == "deep-work"
        assert slugify("Focus Session") == "focus-session"

    def test_handles_multiple_spaces(self) -> None:
        """Consecutive spaces are converted to single hyphens."""
        assert slugify("My   Project") == "my-project"
        assert slugify("Deep  Work  Plan") == "deep-work-plan"

    def test_removes_special_characters(self) -> None:
        """Special characters are removed."""
        assert slugify("Deep Work & Focus") == "deep-work-focus"
        assert slugify("Work (2026)") == "work-2026"
        assert slugify("Project@Home") == "projecthome"

    def test_converts_to_lowercase(self) -> None:
        """Output is always lowercase."""
        assert slugify("UPPERCASE") == "uppercase"
        assert slugify("MixedCase") == "mixedcase"
        assert slugify("CamelCase Text") == "camelcase-text"

    def test_strips_leading_trailing_hyphens(self) -> None:
        """Leading and trailing hyphens are stripped."""
        assert slugify("-leading") == "leading"
        assert slugify("trailing-") == "trailing"
        assert slugify("-both-") == "both"

    def test_collapses_consecutive_hyphens(self) -> None:
        """Consecutive hyphens are collapsed into single hyphen."""
        assert slugify("Work---Deep") == "work-deep"
        assert slugify("Project--Name") == "project-name"

    def test_handles_numbers(self) -> None:
        """Numbers are preserved in slugs."""
        assert slugify("Project 2026") == "project-2026"
        assert slugify("Sprint 5") == "sprint-5"
        assert slugify("Milestone1 Milestone2") == "milestone1-milestone2"

    def test_handles_already_slugified_text(self) -> None:
        """Already slugified text remains unchanged."""
        assert slugify("already-slugified") == "already-slugified"
        assert slugify("my-project-name") == "my-project-name"

    def test_complex_name_conversion(self) -> None:
        """Complex names with mixed characters are handled correctly."""
        assert slugify("My Deep Work & Focus Session!") == "my-deep-work-focus-session"
        assert slugify("Project (Alpha v2.0)") == "project-alpha-v20"

    def test_single_character(self) -> None:
        """Single character names are handled."""
        assert slugify("A") == "a"
        assert slugify("x") == "x"

    def test_empty_string_results_in_empty_slug(self) -> None:
        """Empty string results in empty slug."""
        assert slugify("") == ""

    def test_string_with_only_special_chars(self) -> None:
        """String with only special characters results in empty slug."""
        assert slugify("@#$%^&*()") == ""
        assert slugify("---") == ""


class TestIntegration:
    """Integration tests combining multiple functions."""

    def test_slugify_output_works_with_project_note_path(self) -> None:
        """slugify output is safe to use with project_note_path."""
        name = "My Important Project!"
        slug = slugify(name)
        result = project_note_path(slug)
        assert result == "Projects/my-important-project.md"

    def test_slugify_output_works_with_review_card_path(self) -> None:
        """slugify output is safe to use as deck_slug in review_card_path."""
        deck_name = "Spanish Vocabulary!"
        slug = slugify(deck_name)
        result = review_card_path(slug, "card_1")
        assert result == "Review/spanish-vocabulary/card_1.md"
