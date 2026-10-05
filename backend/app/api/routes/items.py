from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_shop_id
from app.db.session import get_db
from app.models.item import Item
from app.repositories.item import ItemRepository
from app.schemas.item import ItemCreate, ItemRead
from app.services.item import (
    CreateItemService,
    GetItemService,
    SearchItemsService,
)

router = APIRouter(prefix="/items")


@router.post(
    "",
    response_model=ItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_item(
    data: ItemCreate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Item:
    repository = ItemRepository(db)

    service = CreateItemService(
        db=db,
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        data=data,
    )


@router.get(
    "",
    response_model=list[ItemRead],
)
def list_items(
    query: str | None = Query(
        default=None,
        max_length=150,
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
) -> list[Item]:
    repository = ItemRepository(db)

    service = SearchItemsService(
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        query=query,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{item_id}",
    response_model=ItemRead,
)
def get_item(
    item_id: UUID,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Item:
    repository = ItemRepository(db)

    service = GetItemService(
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        item_id=item_id,
    )