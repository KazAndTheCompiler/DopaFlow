"""initial_placeholder

Revision ID: 1e0d184fe0bc
Revises:
Create Date: 2026-04-16 13:59:59.406562

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "1e0d184fe0bc"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
