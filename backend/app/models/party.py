
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Enum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import (
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.enums import PartyType

if TYPE_CHECKING:
    from app.models.ledger_entry import LedgerEntry
    from app.models.shop import Shop
    from app.models.supplier_item import SupplierItem


class Party(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    SoftDeleteMixin,
    Base,
):
    __tablename__ = "parties"

    __table_args__ = (
        UniqueConstraint(
            "shop_id",
            "phone",
            name="uq_parties_shop_phone",
        ),
    )

    shop_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    type: Mapped[PartyType] = mapped_column(
        Enum(
            PartyType,
            name="partytype",
        ),
        nullable=False,
        default=PartyType.CUSTOMER,
        server_default=PartyType.CUSTOMER.value,
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
        back_populates="parties",
    )

    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(
        back_populates="party",
    )

    # Products, units, and prices configured for this supplier.
    supplier_items: Mapped[list["SupplierItem"]] = relationship(
        back_populates="supplier",
    )