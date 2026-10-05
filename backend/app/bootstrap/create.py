from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException
from app.repositories.device import DeviceRepository
from app.repositories.shop import ShopRepository


@dataclass(frozen=True)
class BootstrapResult:
    shop_id: UUID
    device_id: UUID


class CreateBootstrapService:
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
        shop_name: str,
        device_name: str | None = None,
        shop_id: UUID | None = None,
        device_id: UUID | None = None,
    ) -> BootstrapResult:
        shop_id = shop_id or uuid4()
        device_id = device_id or uuid4()

        try:
            self.shop_repository.create(
                shop_id=shop_id,
                name=shop_name.strip(),
            )

            self.device_repository.create(
                device_id=device_id,
                shop_id=shop_id,
                name=device_name.strip() if device_name else None,
            )

            self.db.commit()

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Shop could not be initialized because it conflicts "
                "with an existing record"
            ) from exc

        return BootstrapResult(
            shop_id=shop_id,
            device_id=device_id,
        )