from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncIdentityException
from app.models.device import Device
from app.models.shop import Shop


def validate_sync_identity(
    db: Session,
    *,
    shop_id: UUID,
    device_id: UUID,
) -> None:
    shop = db.get(
        Shop,
        shop_id,
    )

    if shop is None:
        raise SyncIdentityException(
            f"Shop {shop_id} does not exist"
        )

    device = db.get(
        Device,
        device_id,
    )

    if device is None:
        raise SyncIdentityException(
            f"Device {device_id} does not exist"
        )

    if device.shop_id != shop_id:
        raise SyncIdentityException(
            "Device does not belong to this shop"
        )