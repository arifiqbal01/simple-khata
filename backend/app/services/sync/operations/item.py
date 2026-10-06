from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.repositories.item import ItemRepository
from app.schemas.sync import (
    ItemCreateOperation,
    ItemUpdateOperation,
)


def _validate_item_operation(
    *,
    shop_id: UUID,
    operation: ItemCreateOperation | ItemUpdateOperation,
) -> None:
    item = operation.payload.item

    if operation.entityId != item.id:
        raise SyncConflictException(
            "Operation entity ID does not match item ID"
        )

    if item.shopId != shop_id:
        raise SyncConflictException(
            "Item belongs to another shop"
        )


def apply_item_create(
    db: Session,
    *,
    shop_id: UUID,
    operation: ItemCreateOperation,
) -> None:
    _validate_item_operation(
        shop_id=shop_id,
        operation=operation,
    )

    repository = ItemRepository(db)
    data = operation.payload.item

    existing = repository.get_by_id(data.id)

    if existing is not None:
        raise SyncConflictException(
            f"Item {data.id} already exists"
        )

    repository.create(
        item_id=data.id,
        shop_id=shop_id,
        name=data.name.strip(),
    )


def apply_item_update(
    db: Session,
    *,
    shop_id: UUID,
    operation: ItemUpdateOperation,
) -> None:
    _validate_item_operation(
        shop_id=shop_id,
        operation=operation,
    )

    repository = ItemRepository(db)
    data = operation.payload.item

    item = repository.get_by_id_and_shop(
        item_id=data.id,
        shop_id=shop_id,
    )

    if item is None:
        raise SyncConflictException(
            f"Item {data.id} does not exist"
        )

    repository.update(
        item,
        values={
            "name": data.name.strip(),
        },
    )