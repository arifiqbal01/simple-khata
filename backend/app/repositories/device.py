from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.device import Device


class DeviceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        device_id: UUID,
        shop_id: UUID,
        name: str | None = None,
    ) -> Device:
        device = Device(
            id=device_id,
            shop_id=shop_id,
            name=name,
        )

        self.db.add(device)
        self.db.flush()

        return device

    def get_by_id(
        self,
        device_id: UUID,
    ) -> Device | None:
        return self.db.get(Device, device_id)

    def get_by_id_and_shop(
        self,
        *,
        device_id: UUID,
        shop_id: UUID,
    ) -> Device | None:
        statement = select(Device).where(
            Device.id == device_id,
            Device.shop_id == shop_id,
        )

        return self.db.scalar(statement)

    def list_by_shop(
        self,
        *,
        shop_id: UUID,
    ) -> list[Device]:
        statement = (
            select(Device)
            .where(Device.shop_id == shop_id)
            .order_by(Device.created_at, Device.id)
        )

        return list(self.db.scalars(statement).all())