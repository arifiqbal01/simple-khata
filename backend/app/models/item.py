from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.entry_item import EntryItem
    from app.models.shop import Shop


class Item(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "items"

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

    shop: Mapped["Shop"] = relationship(
        back_populates="items",
    )

    entry_items: Mapped[list["EntryItem"]] = relationship(
        back_populates="item",
    )