
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.item import Item
    from app.models.party import Party
    from app.models.supplier_item import SupplierItem


class Shop(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "shops"

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    devices: Mapped[list["Device"]] = relationship(
        back_populates="shop",
    )

    parties: Mapped[list["Party"]] = relationship(
        back_populates="shop",
    )

    items: Mapped[list["Item"]] = relationship(
        back_populates="shop",
    )

    # Products and purchase prices configured for suppliers.
    supplier_items: Mapped[list["SupplierItem"]] = relationship(
        back_populates="shop",
    )