
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.device import Device


def get_shop_id(
    x_shop_id: UUID = Header(alias="X-Shop-ID"),
) -> UUID:
    return x_shop_id


def get_device_id(
    x_device_id: UUID = Header(alias="X-Device-ID"),
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> UUID:
    device = db.get(Device, x_device_id)

    if device is None or device.shop_id != shop_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device does not belong to this shop",
        )

    return device.id
