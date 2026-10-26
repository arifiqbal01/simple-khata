
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import (
    CreatedAtMixin,
    SoftDeleteMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.enums import LedgerEntryType

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.entry_item import EntryItem
    from app.models.party import Party


class LedgerEntry(
    UUIDPrimaryKeyMixin,
    CreatedAtMixin,
    SoftDeleteMixin,
    Base,
):
    __tablename__ = "ledger_entries"

    __table_args__ = (
        CheckConstraint(
            "amount > 0",
            name="ck_ledger_entries_amount_positive",
        ),
    )

    party_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("parties.id"),
        nullable=False,
        index=True,
    )

    device_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("devices.id"),
        nullable=False,
        index=True,
    )

    type: Mapped[LedgerEntryType] = mapped_column(
        Enum(
            LedgerEntryType,
            name="ledger_entry_type",
        ),
        nullable=False,
    )

    # Total amount of the ledger transaction.
    # For UDHAAR and SUPPLY, this can represent the sum
    # of product lines or a manually entered total.
    amount: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    party: Mapped["Party"] = relationship(
        back_populates="ledger_entries",
    )

    device: Mapped["Device"] = relationship(
        back_populates="ledger_entries",
        foreign_keys=[device_id],
    )

    # Product snapshots attached to this transaction.
    line_items: Mapped[list["EntryItem"]] = relationship(
        back_populates="ledger_entry",
    )