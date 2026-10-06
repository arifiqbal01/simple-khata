from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.sync import SyncRepository
from app.schemas.sync import (
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync import (
    PullSyncService,
    PushSyncService,
)

router = APIRouter(prefix="/sync")


@router.post(
    "/push",
    response_model=SyncPushResponse,
)
def push_sync(
    data: SyncPushRequest,
    db: Session = Depends(get_db),
) -> SyncPushResponse:
    repository = SyncRepository(db)

    service = PushSyncService(
        db=db,
        repository=repository,
    )

    return service.execute(data=data)


@router.get(
    "/pull",
    response_model=SyncPullResponse,
)
def pull_sync(
    shop_id: UUID = Query(alias="shopId"),
    device_id: UUID = Query(alias="deviceId"),
    cursor: int = Query(
        default=0,
        ge=0,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
) -> SyncPullResponse:
    repository = SyncRepository(db)

    service = PullSyncService(
        db=db,
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        device_id=device_id,
        cursor=cursor,
        limit=limit,
    )