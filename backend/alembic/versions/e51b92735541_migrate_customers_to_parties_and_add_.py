
"""Migrate customers to parties and add supplier support.

Revision ID: e51b92735541
Revises: d78019a3f0a0
Create Date: 2026-10-25 07:02:22.581791
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e51b92735541"
down_revision: Union[str, Sequence[str], None] = "d78019a3f0a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PARTY_TYPE_ENUM = postgresql.ENUM(
    "CUSTOMER",
    "SUPPLIER",
    name="partytype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create the PartyType PostgreSQL enum.
    PARTY_TYPE_ENUM.create(bind, checkfirst=True)

    # 2. Rename customers -> parties.
    # PostgreSQL preserves all rows and existing foreign keys.
    op.rename_table("customers", "parties")

    # 3. Add party type and soft-delete fields.
    op.add_column(
        "parties",
        sa.Column(
            "type",
            PARTY_TYPE_ENUM,
            nullable=False,
            server_default=sa.text("'CUSTOMER'::partytype"),
        ),
    )

    op.add_column(
        "parties",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "parties",
        sa.Column(
            "deleted_by_device_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    # Keep CUSTOMER as the database default for compatibility
    # with existing customer-only clients.

    # 4. Add FK for the deleting device.
    op.create_foreign_key(
        "fk_parties_deleted_by_device_id_devices",
        "parties",
        "devices",
        ["deleted_by_device_id"],
        ["id"],
    )

    op.create_index(
        "ix_parties_deleted_by_device_id",
        "parties",
        ["deleted_by_device_id"],
    )

    # 5. Rename existing customer table constraints.
    op.execute(
        "ALTER TABLE parties "
        "RENAME CONSTRAINT customers_shop_id_fkey "
        "TO parties_shop_id_fkey"
    )

    op.execute(
        "ALTER TABLE parties "
        "RENAME CONSTRAINT uq_customers_shop_phone "
        "TO uq_parties_shop_phone"
    )

    op.execute(
        "ALTER INDEX ix_customers_shop_id "
        "RENAME TO ix_parties_shop_id"
    )

    # 6. Rename ledger_entries.customer_id -> party_id.
    op.alter_column(
        "ledger_entries",
        "customer_id",
        new_column_name="party_id",
        existing_type=sa.UUID(),
        existing_nullable=False,
    )

    # 7. Rename ledger foreign key and index.
    op.execute(
        "ALTER TABLE ledger_entries "
        "RENAME CONSTRAINT ledger_entries_customer_id_fkey "
        "TO ledger_entries_party_id_fkey"
    )

    op.execute(
        "ALTER INDEX ix_ledger_entries_customer_id "
        "RENAME TO ix_ledger_entries_party_id"
    )

    # 8. Add SUPPLY to the existing PostgreSQL enum.
    # This is the actual enum name found in your database.
    op.execute(
        "ALTER TYPE ledger_entry_type "
        "ADD VALUE IF NOT EXISTS 'SUPPLY'"
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Prevent data loss when supplier records exist.
    supplier_count = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM parties "
            "WHERE type = 'SUPPLIER'"
        )
    ).scalar_one()

    supply_count = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM ledger_entries "
            "WHERE type = 'SUPPLY'"
        )
    ).scalar_one()

    deleted_party_count = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM parties "
            "WHERE deleted_at IS NOT NULL "
            "OR deleted_by_device_id IS NOT NULL"
        )
    ).scalar_one()

    if supplier_count or supply_count or deleted_party_count:
        raise RuntimeError(
            "Cannot downgrade: supplier records, SUPPLY "
            "entries, or deleted parties exist."
        )

    # 1. Restore ledger column.
    op.alter_column(
        "ledger_entries",
        "party_id",
        new_column_name="customer_id",
        existing_type=sa.UUID(),
        existing_nullable=False,
    )

    op.execute(
        "ALTER TABLE ledger_entries "
        "RENAME CONSTRAINT ledger_entries_party_id_fkey "
        "TO ledger_entries_customer_id_fkey"
    )

    op.execute(
        "ALTER INDEX ix_ledger_entries_party_id "
        "RENAME TO ix_ledger_entries_customer_id"
    )

    # 2. Restore customer constraint names.
    op.execute(
        "ALTER TABLE parties "
        "RENAME CONSTRAINT parties_shop_id_fkey "
        "TO customers_shop_id_fkey"
    )

    op.execute(
        "ALTER TABLE parties "
        "RENAME CONSTRAINT uq_parties_shop_phone "
        "TO uq_customers_shop_phone"
    )

    op.execute(
        "ALTER INDEX ix_parties_shop_id "
        "RENAME TO ix_customers_shop_id"
    )

    # 3. Remove party-specific fields.
    op.drop_index(
        "ix_parties_deleted_by_device_id",
        table_name="parties",
    )

    op.drop_constraint(
        "fk_parties_deleted_by_device_id_devices",
        "parties",
        type_="foreignkey",
    )

    op.drop_column("parties", "deleted_by_device_id")
    op.drop_column("parties", "deleted_at")
    op.drop_column("parties", "type")

    # 4. Rename parties -> customers.
    op.rename_table("parties", "customers")

    # 5. Remove PartyType enum.
    PARTY_TYPE_ENUM.drop(bind, checkfirst=True)

    # PostgreSQL does not support removing an enum value
    # directly. SUPPLY remains in ledger_entry_type.