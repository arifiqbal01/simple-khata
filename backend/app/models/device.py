from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.ledger_entry import LedgerEntry
    from app.models.shop import Shop


class Device(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "devices"

    shop_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    shop: Mapped["Shop"] = relationship(
        back_populates="devices",
    )

    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(
        back_populates="device",
    )