
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
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

if TYPE_CHECKING:
    from app.models.entry_item import EntryItem
    from app.models.shop import Shop
    from app.models.supplier_item import SupplierItem


class Item(
    UUIDPrimaryKeyMixin,
    CreatedAtMixin,
    SoftDeleteMixin,
    Base,
):
    __tablename__ = "items"

    __table_args__ = (
        CheckConstraint(
            "default_selling_price IS NULL "
            "OR default_selling_price >= 0",
            name="ck_items_default_selling_price_nonnegative",
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

    # Default unit used when selling this product.
    # Examples: kg, gram, liter, piece, packet.
    default_unit: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    # Default selling price per unit.
    # Supplier purchase prices are stored in supplier_items.
    default_selling_price: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
    )

    shop: Mapped["Shop"] = relationship(
        back_populates="items",
    )

    # Historical transaction item snapshots.
    entry_items: Mapped[list["EntryItem"]] = relationship(
        back_populates="item",
    )

    # Supplier-specific product offerings and purchase prices.
    supplier_items: Mapped[list["SupplierItem"]] = relationship(
        back_populates="item",
    )