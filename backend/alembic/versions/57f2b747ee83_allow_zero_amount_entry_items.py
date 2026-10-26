"""allow zero amount entry items

Revision ID: 57f2b747ee83
Revises: b06e83f67c0c
Create Date: 2026-10-26 15:09:43.464417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '57f2b747ee83'
down_revision: Union[str, Sequence[str], None] = 'b06e83f67c0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow zero-value entry items while preserving NULL amounts."""
    op.drop_constraint(
        "ck_entry_items_amount_positive",
        "entry_items",
        type_="check",
    )

    op.create_check_constraint(
        "ck_entry_items_amount_nonnegative",
        "entry_items",
        "amount >= 0",
    )


def downgrade() -> None:
    """Restore the original positive-amount constraint."""
    op.drop_constraint(
        "ck_entry_items_amount_nonnegative",
        "entry_items",
        type_="check",
    )

    op.create_check_constraint(
        "ck_entry_items_amount_positive",
        "entry_items",
        "amount > 0",
    )
