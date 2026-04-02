"""Business logic for the notifications domain."""

from __future__ import annotations

from app.domains.notifications.repository import NotificationsRepository
from app.domains.notifications.schemas import Notification, NotificationCreate, NotificationLevel, UnreadCount


class NotificationsService:
    """Coordinate inbox reads, archives, and unread count polling."""

    def __init__(self, repository: NotificationsRepository) -> None:
        self.repository = repository

    def list_notifications(
        self,
        archived: bool | None = None,
        level: NotificationLevel | None = None,
    ) -> list[Notification]:
        """Return inbox notifications."""

        return self.repository.list_notifications(archived=archived, level=level)

    def create_notification(self, payload: NotificationCreate) -> Notification:
        """Create an inbox notification."""

        return self.repository.create_notification(payload)

    def mark_read(self, identifier: str) -> Notification | None:
        """Mark a single notification as read."""

        return self.repository.mark_read(identifier)

    def mark_all_read(self) -> UnreadCount:
        """Mark every notification read."""

        return self.repository.mark_all_read()

    def archive(self, identifier: str) -> Notification | None:
        """Archive a notification."""

        return self.repository.archive(identifier)

    def delete(self, identifier: str) -> bool:
        """Delete a notification."""

        return self.repository.delete(identifier)

    def unread_count(self) -> UnreadCount:
        """Return the unread counter."""

        return self.repository.unread_count()
