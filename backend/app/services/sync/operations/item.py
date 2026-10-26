
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.repositories.item import ItemRepository
from app.schemas.sync import (
    ItemCreateOperation,
    ItemUpdateOperation,
    ItemDeleteOperation,
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

    # Include deleted records to prevent resurrection.
    existing = repository.get_by_id(data.id)

    if existing is not None:
        raise SyncConflictException(
            f"Item {data.id} already exists"
        )

    repository.create(
        item_id=data.id,
        shop_id=shop_id,
        name=data.name.strip(),
        default_unit=data.defaultUnit,
        default_selling_price=data.defaultSellingPrice,
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
        include_deleted=True,
    )

    if item is None:
        raise SyncConflictException(
            f"Item {data.id} does not exist"
        )

    if item.deleted_at is not None:
        raise SyncConflictException(
            f"Item {data.id} has been deleted"
        )

    repository.update(
        item,
        values={
            "name": data.name.strip(),
            "default_unit": data.defaultUnit,
            "default_selling_price": data.defaultSellingPrice,
        },
    )



def apply_item_delete(
    db: Session,
    *,
    shop_id: UUID,
    device_id: UUID,
    operation: ItemDeleteOperation,
) -> None:
    data = operation.payload.item

    # Validate operation entity ID.
    if operation.entityId != data.id:
        raise SyncConflictException(
            "Operation entity ID does not match item ID"
        )

    # The deletion must originate from the authenticated device.
    if data.deletedByDeviceId != device_id:
        raise SyncConflictException(
            "Item deletion device does not match authenticated device"
        )

    repository = ItemRepository(db)

    # Include soft-deleted item for idempotent processing.
    item = repository.get_by_id_and_shop(
        item_id=data.id,
        shop_id=shop_id,
        include_deleted=True,
    )

    if item is None:
        raise SyncConflictException(
            f"Item {data.id} does not exist in this shop"
        )

    # Already deleted: preserve the original deletion metadata.
    if item.deleted_at is not None:
        return

    # The server generates the canonical deletion timestamp.
    # The authenticated device is recorded as the deleting device.
    repository.soft_delete(
        item=item,
        device_id=device_id,
    )