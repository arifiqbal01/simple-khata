
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.item import Item
    from app.models.party import Party
    from app.models.shop import Shop


class SupplierItem(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "supplier_items"

    __table_args__ = (
        UniqueConstraint(
            "supplier_id",
            "item_id",
            name="uq_supplier_items_supplier_item",
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_supplier_items_unit_price_nonnegative",
        ),
    )

    shop_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    # References a Party whose type must be SUPPLIER.
    supplier_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("parties.id"),
        nullable=False,
        index=True,
    )

    # Product from the shop's item catalog.
    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("items.id"),
        nullable=False,
        index=True,
    )

    # Supplier's default unit for this product.
    # Examples: kg, liter, piece, packet.
    unit: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    # Supplier's default purchase price per unit.
    unit_price: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    # Last time this supplier product was updated.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    shop: Mapped["Shop"] = relationship(
        back_populates="supplier_items",
    )

    supplier: Mapped["Party"] = relationship(
        back_populates="supplier_items",
    )

    item: Mapped["Item"] = relationship(
        back_populates="supplier_items",
    )