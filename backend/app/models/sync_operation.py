from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin


class SyncOperation(
    UUIDPrimaryKeyMixin,
    CreatedAtMixin,
    Base,
):
    __tablename__ = "sync_operations"

    shop_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "shops.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    device_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "devices.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    operation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    entity_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "ix_sync_operations_shop_created",
            "shop_id",
            "created_at",
        ),
        Index(
            "ix_sync_operations_shop_entity",
            "shop_id",
            "entity_type",
            "entity_id",
        ),
    )