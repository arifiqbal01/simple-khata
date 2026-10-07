from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String
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
            "amount > 0",
            name="ck_entry_items_amount_positive",
        ),
    )

    ledger_entry_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("ledger_entries.id"),
        nullable=False,
        index=True,
    )

    item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("items.id"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    amount: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    ledger_entry: Mapped["LedgerEntry"] = relationship(
        back_populates="items",
    )

    item: Mapped["Item | None"] = relationship(
        back_populates="entry_items",
    )