from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.bootstrap.create import CreateBootstrapService
from app.db.session import get_db
from app.repositories.device import DeviceRepository
from app.repositories.shop import ShopRepository
from app.schemas.bootstrap import BootstrapCreate, BootstrapRead

router = APIRouter()


@router.post(
    "/bootstrap",
    response_model=BootstrapRead,
    status_code=status.HTTP_201_CREATED,
)
def create_bootstrap(
    data: BootstrapCreate,
    db: Session = Depends(get_db),
) -> BootstrapRead:
    service = CreateBootstrapService(
        db=db,
        shop_repository=ShopRepository(db),
        device_repository=DeviceRepository(db),
    )

    result = service.execute(
        shop_name=data.shop_name,
        device_name=data.device_name,
        shop_id=data.shop_id,
        device_id=data.device_id,
    )

    return BootstrapRead(
        shop_id=result.shop_id,
        device_id=result.device_id,
    )