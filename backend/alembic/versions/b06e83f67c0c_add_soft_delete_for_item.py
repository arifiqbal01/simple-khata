"""add soft delete for item

Revision ID: b06e83f67c0c
Revises: 8c743ab77169
Create Date: 2026-10-25 08:02:59.847399

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b06e83f67c0c'
down_revision: Union[str, Sequence[str], None] = '8c743ab77169'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    """Add soft-delete support to item."""

    op.add_column(
        "item",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "item",
        sa.Column(
            "deleted_by_device_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_items_deleted_by_device_id",
        "item",
        ["deleted_by_device_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_items_deleted_by_device_id_devices",
        "item",
        "devices",
        ["deleted_by_device_id"],
        ["id"],
    )


def downgrade() -> None:
    """Remove soft-delete support from item."""

    op.drop_constraint(
        "fk_items_deleted_by_device_id_devices",
        "item",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_items_deleted_by_device_id",
        table_name="item",
    )

    op.drop_column(
        "item",
        "deleted_by_device_id",
    )

    op.drop_column(
        "item",
        "deleted_at",
    )
