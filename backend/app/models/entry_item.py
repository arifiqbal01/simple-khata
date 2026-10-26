
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.ledger_entry import LedgerEntry


class EntryItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "entry_items"

    __table_args__ = (
        CheckConstraint(
            "amount >= 0",
            name="ck_entry_items_amount_nonnegative",
        ),
        CheckConstraint(
            "quantity IS NULL OR quantity > 0",
            name="ck_entry_items_quantity_positive",
        ),
        CheckConstraint(
            "unit_price IS NULL OR unit_price >= 0",
            name="ck_entry_items_unit_price_nonnegative",
        ),
    )

    ledger_entry_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("ledger_entries.id"),
        nullable=False,
        index=True,
    )

    # Optional reference to a saved product.
    item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("items.id"),
        nullable=True,
        index=True,
    )

    # Product name at the time of transaction.
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    # Examples: 50, 1.5, 0.250
    quantity: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 3),
        nullable=True,
    )

    # Examples: kg, liter, piece, packet
    unit: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    # Price per unit for this transaction.
    unit_price: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    # Total price of this line.
    amount: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    ledger_entry: Mapped["LedgerEntry"] = relationship(
        back_populates="line_items",
    )

    item: Mapped["Item | None"] = relationship(
        back_populates="entry_items",
    )