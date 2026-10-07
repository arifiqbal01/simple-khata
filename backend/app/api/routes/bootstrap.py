from fastapi import (
    APIRouter,
    Depends,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.device import DeviceRepository
from app.repositories.shop import ShopRepository
from app.schemas.bootstrap import (
    BootstrapCreate,
    BootstrapJoin,
    BootstrapRead,
)
from app.services.bootstrap.create import (
    CreateBootstrapService,
)
from app.services.bootstrap.join import (
    JoinBootstrapService,
)

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


@router.post(
    "/bootstrap/join",
    response_model=BootstrapRead,
    status_code=status.HTTP_201_CREATED,
)
def join_bootstrap(
    data: BootstrapJoin,
    db: Session = Depends(get_db),
) -> BootstrapRead:
    service = JoinBootstrapService(
        db=db,
        shop_repository=ShopRepository(db),
        device_repository=DeviceRepository(db),
    )

    result = service.execute(
        shop_id=data.shop_id,
        device_id=data.device_id,
        device_name=data.device_name,
    )

    return BootstrapRead(
        shop_id=result.shop_id,
        device_id=result.device_id,
    )