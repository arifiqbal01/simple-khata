
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_shop_id
from app.db.session import get_db
from app.models.enums import PartyType
from app.models.party import Party
from app.repositories.party_repository import PartyRepository
from app.schemas.party import (
    PartyCreate,
    PartyRead,
    PartyUpdate,
)
from app.services.party import (
    CreatePartyService,
    GetPartyService,
    SearchPartiesService,
    UpdatePartyService,
    DeletePartyService,
)

router = APIRouter(prefix="/parties")


@router.post(
    "",
    response_model=PartyRead,
    status_code=status.HTTP_201_CREATED,
)
def create_party(
    data: PartyCreate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Party:
    repository = PartyRepository(db)

    service = CreatePartyService(
        db=db,
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        data=data,
    )


@router.get(
    "",
    response_model=list[PartyRead],
)
def list_parties(
    query: str | None = Query(
        default=None,
        max_length=150,
    ),
    party_type: PartyType | None = Query(
        default=None,
        alias="type",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> list[Party]:
    repository = PartyRepository(db)

    service = SearchPartiesService(
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        query=query,
        party_type=party_type,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{party_id}",
    response_model=PartyRead,
)
def get_party(
    party_id: UUID,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Party:
    repository = PartyRepository(db)

    service = GetPartyService(
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        party_id=party_id,
    )


@router.patch(
    "/{party_id}",
    response_model=PartyRead,
)
def update_party(
    party_id: UUID,
    data: PartyUpdate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Party:
    repository = PartyRepository(db)

    service = UpdatePartyService(
        db=db,
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        party_id=party_id,
        data=data,
    )


@router.delete(
    "/{party_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_party(
    party_id: UUID,
    device_id: UUID = Query(...),
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> None:
    repository = PartyRepository(db)

    service = DeletePartyService(
        db=db,
        repository=repository,
    )

    service.execute(
        shop_id=shop_id,
        party_id=party_id,
        device_id=device_id,
    )