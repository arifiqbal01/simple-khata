
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.models.enums import PartyType
from app.models.item import Item
from app.models.party import Party
from app.repositories.supplier_item import SupplierItemRepository
from app.schemas.sync import (
    SupplierItemCreateOperation,
    SupplierItemUpdateOperation,
    SupplierItemDeleteOperation,
)


def _validate_supplier_item_operation(
    *,
    shop_id: UUID,
    operation: (
        SupplierItemCreateOperation
        | SupplierItemUpdateOperation
        | SupplierItemDeleteOperation
    ),
) -> None:
    data = operation.payload.supplierItem

    if operation.entityId != data.id:
        raise SyncConflictException(
            "Operation entity ID does not match supplier item ID"
        )

    if data.shopId != shop_id:
        raise SyncConflictException(
            "Supplier item belongs to another shop"
        )


def _validate_supplier_and_item(
    db: Session,
    *,
    shop_id: UUID,
    supplier_id: UUID,
    item_id: UUID,
) -> None:
    supplier = db.get(Party, supplier_id)

    if (
        supplier is None
        or supplier.shop_id != shop_id
        or supplier.type != PartyType.SUPPLIER
        or supplier.deleted_at is not None
    ):
        raise SyncConflictException(
            "Supplier does not exist or is inactive in this shop"
        )

    item = db.get(Item, item_id)

    if (
        item is None
        or item.shop_id != shop_id
        or item.deleted_at is not None
    ):
        raise SyncConflictException(
            "Catalog item does not exist or is inactive in this shop"
        )


def apply_supplier_item_create(
    db: Session,
    *,
    shop_id: UUID,
    operation: SupplierItemCreateOperation,
) -> None:
    _validate_supplier_item_operation(
        shop_id=shop_id,
        operation=operation,
    )

    data = operation.payload.supplierItem
    repository = SupplierItemRepository(db)

    _validate_supplier_and_item(
        db,
        shop_id=shop_id,
        supplier_id=data.supplierId,
        item_id=data.itemId,
    )

    if repository.get_by_id(data.id) is not None:
        raise SyncConflictException(
            f"Supplier item {data.id} already exists"
        )

    existing = repository.get_by_supplier_and_item(
        shop_id=shop_id,
        supplier_id=data.supplierId,
        item_id=data.itemId,
    )

    if existing is not None:
        raise SyncConflictException(
            "This supplier already has this product"
        )

    unit = data.unit.strip()

    if not unit:
        raise SyncConflictException(
            "Supplier item unit is required"
        )

    repository.create(
        supplier_item_id=data.id,
        shop_id=shop_id,
        supplier_id=data.supplierId,
        item_id=data.itemId,
        unit=unit,
        unit_price=data.unitPrice,
    )


def apply_supplier_item_update(
    db: Session,
    *,
    shop_id: UUID,
    operation: SupplierItemUpdateOperation,
) -> None:
    _validate_supplier_item_operation(
        shop_id=shop_id,
        operation=operation,
    )

    data = operation.payload.supplierItem
    repository = SupplierItemRepository(db)

    supplier_item = repository.get_by_id_and_shop(
        supplier_item_id=data.id,
        shop_id=shop_id,
    )

    if supplier_item is None:
        raise SyncConflictException(
            f"Supplier item {data.id} does not exist in this shop"
        )

    if (
        supplier_item.supplier_id != data.supplierId
        or supplier_item.item_id != data.itemId
    ):
        raise SyncConflictException(
            "Supplier item association cannot be changed"
        )

    _validate_supplier_and_item(
        db,
        shop_id=shop_id,
        supplier_id=data.supplierId,
        item_id=data.itemId,
    )

    unit = data.unit.strip()

    if not unit:
        raise SyncConflictException(
            "Supplier item unit is required"
        )

    repository.update(
        supplier_item,
        values={
            "unit": unit,
            "unit_price": data.unitPrice,
        },
    )


def apply_supplier_item_delete(
    db: Session,
    *,
    shop_id: UUID,
    operation: SupplierItemDeleteOperation,
) -> None:
    _validate_supplier_item_operation(
        shop_id=shop_id,
        operation=operation,
    )

    data = operation.payload.supplierItem
    repository = SupplierItemRepository(db)

    supplier_item = repository.get_by_id_and_shop(
        supplier_item_id=data.id,
        shop_id=shop_id,
    )

    # Already absent: allow idempotent deletion.
    if supplier_item is None:
        return

    if (
        supplier_item.supplier_id != data.supplierId
        or supplier_item.item_id != data.itemId
    ):
        raise SyncConflictException(
            "Supplier item association does not match delete request"
        )

    repository.delete(
        supplier_item=supplier_item,
    )
