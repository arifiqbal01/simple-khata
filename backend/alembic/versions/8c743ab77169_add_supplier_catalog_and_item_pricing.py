
"""add supplier catalog and item pricing

Revision ID: 8c743ab77169
Revises: e51b92735541
Create Date: 2026-10-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c743ab77169"
down_revision: Union[str, Sequence[str], None] = "e51b92735541"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add product defaults to items.

    op.add_column(
        "items",
        sa.Column(
            "default_unit",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.add_column(
        "items",
        sa.Column(
            "default_selling_price",
            sa.BigInteger(),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "ck_items_default_selling_price_nonnegative",
        "items",
        "default_selling_price IS NULL "
        "OR default_selling_price >= 0",
    )

    # 2. Add quantity and pricing to entry_items.

    op.add_column(
        "entry_items",
        sa.Column(
            "quantity",
            sa.Numeric(precision=12, scale=3),
            nullable=True,
        ),
    )

    op.add_column(
        "entry_items",
        sa.Column(
            "unit",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.add_column(
        "entry_items",
        sa.Column(
            "unit_price",
            sa.BigInteger(),
            nullable=True,
        ),
    )

    op.create_check_constraint(
        "ck_entry_items_quantity_positive",
        "entry_items",
        "quantity IS NULL OR quantity > 0",
    )

    op.create_check_constraint(
        "ck_entry_items_unit_price_nonnegative",
        "entry_items",
        "unit_price IS NULL OR unit_price >= 0",
    )

    # 3. Create supplier product catalog.

    op.create_table(
        "supplier_items",
        sa.Column(
            "id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "shop_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.UUID(),
            nullable=False,
        ),
        sa.Column(
            "unit",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "unit_price",
            sa.BigInteger(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["shop_id"],
            ["shops.id"],
        ),
        sa.ForeignKeyConstraint(
            ["supplier_id"],
            ["parties.id"],
        ),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["items.id"],
        ),
        sa.UniqueConstraint(
            "supplier_id",
            "item_id",
            name="uq_supplier_items_supplier_item",
        ),
        sa.CheckConstraint(
            "unit_price >= 0",
            name="ck_supplier_items_unit_price_nonnegative",
        ),
    )

    op.create_index(
        "ix_supplier_items_shop_id",
        "supplier_items",
        ["shop_id"],
        unique=False,
    )

    op.create_index(
        "ix_supplier_items_supplier_id",
        "supplier_items",
        ["supplier_id"],
        unique=False,
    )

    op.create_index(
        "ix_supplier_items_item_id",
        "supplier_items",
        ["item_id"],
        unique=False,
    )


def downgrade() -> None:
    # 1. Remove supplier product catalog.

    op.drop_index(
        "ix_supplier_items_item_id",
        table_name="supplier_items",
    )

    op.drop_index(
        "ix_supplier_items_supplier_id",
        table_name="supplier_items",
    )

    op.drop_index(
        "ix_supplier_items_shop_id",
        table_name="supplier_items",
    )

    op.drop_table("supplier_items")

    # 2. Remove entry_items additions.

    op.drop_constraint(
        "ck_entry_items_unit_price_nonnegative",
        "entry_items",
        type_="check",
    )

    op.drop_constraint(
        "ck_entry_items_quantity_positive",
        "entry_items",
        type_="check",
    )

    op.drop_column("entry_items", "unit_price")
    op.drop_column("entry_items", "unit")
    op.drop_column("entry_items", "quantity")

    # 3. Remove item defaults.

    op.drop_constraint(
        "ck_items_default_selling_price_nonnegative",
        "items",
        type_="check",
    )

    op.drop_column("items", "default_selling_price")
    op.drop_column("items", "default_unit")
