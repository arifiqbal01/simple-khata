"""add ledger entry soft delete

Revision ID: d78019a3f0a0
Revises: 960d69879b1c
Create Date: 2026-10-07 16:30:49.978984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd78019a3f0a0'
down_revision: Union[str, Sequence[str], None] = '960d69879b1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "ledger_entries",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "ledger_entries",
        sa.Column(
            "deleted_by_device_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.create_index(
        op.f("ix_ledger_entries_deleted_by_device_id"),
        "ledger_entries",
        ["deleted_by_device_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_ledger_entries_deleted_by_device_id_devices",
        "ledger_entries",
        "devices",
        ["deleted_by_device_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_ledger_entries_deleted_by_device_id_devices",
        "ledger_entries",
        type_="foreignkey",
    )

    op.drop_index(
        op.f("ix_ledger_entries_deleted_by_device_id"),
        table_name="ledger_entries",
    )

    op.drop_column(
        "ledger_entries",
        "deleted_by_device_id",
    )

    op.drop_column(
        "ledger_entries",
        "deleted_at",
    )
