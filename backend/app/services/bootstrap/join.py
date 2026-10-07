from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.repositories.device import DeviceRepository
from app.repositories.shop import ShopRepository


@dataclass(frozen=True)
class JoinBootstrapResult:
    shop_id: UUID
    device_id: UUID


class JoinBootstrapService:
    def __init__(
        self,
        db: Session,
        shop_repository: ShopRepository,
        device_repository: DeviceRepository,
    ) -> None:
        self.db = db
        self.shop_repository = shop_repository
        self.device_repository = device_repository

    def execute(
        self,
        *,
        shop_id: UUID,
        device_id: UUID,
        device_name: str | None = None,
    ) -> JoinBootstrapResult:
        shop = self.shop_repository.get_by_id(
            shop_id
        )

        if shop is None:
            raise NotFoundException(
                f"Shop {shop_id} does not exist"
            )

        existing_device = (
            self.device_repository.get_by_id(
                device_id
            )
        )

        # Make retrying the same join request safe.
        if existing_device is not None:
            if existing_device.shop_id != shop_id:
                raise ConflictException(
                    "Device already belongs to another shop"
                )

            return JoinBootstrapResult(
                shop_id=shop_id,
                device_id=device_id,
            )

        try:
            self.device_repository.create(
                device_id=device_id,
                shop_id=shop_id,
                name=(
                    device_name.strip()
                    if device_name
                    else None
                ),
            )

            self.db.commit()

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Device could not be registered"
            ) from exc

        return JoinBootstrapResult(
            shop_id=shop_id,
            device_id=device_id,
        )