from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.ledger_entry import LedgerEntry
    from app.models.shop import Shop


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customers"

    __table_args__ = (
        UniqueConstraint(
            "shop_id",
            "phone",
            name="uq_customers_shop_phone",
        ),
    )

    shop_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    phone: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    shop: Mapped["Shop"] = relationship(
        back_populates="customers",
    )

    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(
        back_populates="customer",
    )