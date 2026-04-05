"""Pure Python utility for Obsidian vault file naming and slug generation.

No framework dependencies. Provides safe path construction and slug generation
for vault file organization.
"""

from __future__ import annotations

import re


def journal_note_path(date_str: str) -> str:
    """Return the vault path for a daily journal note.

    Args:
        date_str: An ISO date string (YYYY-MM-DD format).

    Returns:
        The relative path 'Daily/YYYY-MM-DD.md'.

    Example:
        >>> journal_note_path("2026-04-05")
        'Daily/2026-04-05.md'
    """
    return f"Daily/{date_str}.md"


def task_inbox_path() -> str:
    """Return the vault path for the task inbox.

    Returns:
        The relative path 'Tasks/Inbox.md'.

    Example:
        >>> task_inbox_path()
        'Tasks/Inbox.md'
    """
    return "Tasks/Inbox.md"


def project_note_path(slug: str) -> str:
    """Return the vault path for a project note.

    Args:
        slug: A vault-safe slug (lowercase, hyphens only, no path separators).

    Returns:
        The relative path 'Projects/<slug>.md'.

    Raises:
        ValueError: If slug is empty, contains "..", or contains "/" or "\".

    Example:
        >>> project_note_path("my-project")
        'Projects/my-project.md'
    """
    _validate_slug(slug)
    return f"Projects/{slug}.md"


def review_card_path(deck_slug: str, card_id: str) -> str:
    """Return the vault path for a review card.

    Args:
        deck_slug: A vault-safe slug for the deck.
        card_id: The review card ID.

    Returns:
        The relative path 'Review/<deck_slug>/<card_id>.md'.

    Raises:
        ValueError: If deck_slug or card_id are invalid.

    Example:
        >>> review_card_path("spanish-vocab", "card_123")
        'Review/spanish-vocab/card_123.md'
    """
    _validate_slug(deck_slug)
    if not card_id:
        raise ValueError("card_id cannot be empty")
    if ".." in card_id or "/" in card_id or "\\" in card_id:
        raise ValueError("card_id contains invalid path characters")

    return f"Review/{deck_slug}/{card_id}.md"


def attachment_path(filename: str) -> str:
    """Return the vault path for an attachment file.

    Args:
        filename: The name of the attachment file.

    Returns:
        The relative path 'Attachments/<filename>'.

    Example:
        >>> attachment_path("image.png")
        'Attachments/image.png'
    """
    return f"Attachments/{filename}"


def slugify(name: str) -> str:
    """Convert a display name to a vault-safe slug.

    Args:
        name: A display name (e.g., "My Project Name").

    Returns:
        A lowercase, hyphen-separated slug with non-alphanumeric chars stripped
        (except hyphens).

    Example:
        >>> slugify("My Project Name")
        'my-project-name'
        >>> slugify("Deep Work & Focus")
        'deep-work-focus'
    """
    # Convert to lowercase
    slug = name.lower()

    # Replace spaces with hyphens
    slug = slug.replace(" ", "-")

    # Remove any character that is not alphanumeric or hyphen
    slug = re.sub(r"[^a-z0-9\-]", "", slug)

    # Collapse consecutive hyphens into a single hyphen
    slug = re.sub(r"-+", "-", slug)

    # Strip leading and trailing hyphens
    slug = slug.strip("-")

    return slug


def _validate_slug(slug: str) -> None:
    """Validate that a slug is safe for use in vault paths.

    Args:
        slug: The slug to validate.

    Raises:
        ValueError: If slug is empty, contains "..", or contains "/" or "\".
    """
    if not slug:
        raise ValueError("slug cannot be empty")
    if ".." in slug:
        raise ValueError("slug contains path traversal attempt (..)")
    if "/" in slug or "\\" in slug:
        raise ValueError("slug contains path separator")
