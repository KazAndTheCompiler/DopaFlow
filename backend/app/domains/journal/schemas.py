"""Pydantic schemas for the journal domain."""

from __future__ import annotations

from pydantic import BaseModel, Field


class JournalEntryCreate(BaseModel):
    """Payload for creating or updating a journal entry."""

    markdown_body: str
    emoji: str | None = None
    date: str
    tags: list[str] = Field(default_factory=list)


class JournalEntryPatch(BaseModel):
    """Partial update payload for a journal entry."""

    markdown_body: str | None = None
    emoji: str | None = None
    tags: list[str] | None = None


class JournalEntryRead(JournalEntryCreate):
    """Serialized journal entry returned from the API."""

    id: str
    version: int = 1
    locked: bool = False
    auto_tags: list[str] = Field(default_factory=list)


class JournalDeleteResponse(BaseModel):
    """Response after soft-deleting a journal entry."""

    deleted: bool
    identifier: str


class JournalBackupStatus(BaseModel):
    """Status payload for journal backup health."""

    backup_path: str
    last_backup_at: str | None = None


class JournalBackupTriggerResponse(BaseModel):
    """Confirmation that a manual backup was triggered."""

    message: str
    backed_up_date: str | None = None


class JournalVersionSummary(BaseModel):
    """A single entry in the version history list."""

    version_number: int
    word_count: int | None = None
    saved_at: str


class JournalVersionDetail(BaseModel):
    """Full content of a specific version."""

    body: str
    saved_at: str


class JournalSearchResult(BaseModel):
    """One hit from a journal search."""

    id: str
    date: str
    snippet: str
    emoji: str | None = None


class JournalAnalyticsSummary(BaseModel):
    """High-level writing analytics over a date range."""

    total_entries: int
    streak_current: int
    streak_longest: int
    avg_word_count: float
    mood_distribution: dict[str, int]
    words_per_day: list[dict[str, object]]
    tags_top: list[dict[str, object]]
    auto_tags_top: list[dict[str, object]]


class JournalToCardIn(BaseModel):
    """Payload to promote a journal excerpt to a review card."""

    front: str
    back: str
    deck_id: str
    source_date: str


class JournalPromptResponse(BaseModel):
    """Contextual writing prompts for a given date."""

    prompts: list[str]


class JournalTemplate(BaseModel):
    """A reusable journal entry template."""

    id: str
    name: str
    body: str
    tags: list[str] = Field(default_factory=list)
    created_at: str | None = None


class JournalTemplateCreate(BaseModel):
    """Payload for creating a journal template."""

    name: str
    body: str
    tags: list[str] = Field(default_factory=list)


class JournalTemplatePatch(BaseModel):
    """Partial update payload for a journal template."""

    name: str | None = None
    body: str | None = None
    tags: list[str] | None = None
