from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.models.enums import LedgerEntryType
from app.repositories.customer import CustomerRepository
from app.repositories.device import DeviceRepository
from app.repositories.entry_item import EntryItemRepository
from app.repositories.item import ItemRepository
from app.repositories.ledger_entry import LedgerEntryRepository
from app.schemas.sync import LedgerEntryCreateOperation


def apply_ledger_entry_create(
    db: Session,
    *,
    shop_id: UUID,
    device_id: UUID,
    operation: LedgerEntryCreateOperation,
) -> None:
    data = operation.payload.entry
    items = operation.payload.items

    ledger_repository = LedgerEntryRepository(db)
    entry_item_repository = EntryItemRepository(db)
    customer_repository = CustomerRepository(db)
    device_repository = DeviceRepository(db)
    item_repository = ItemRepository(db)

    if operation.entityId != data.id:
        raise SyncConflictException(
            "Operation entity ID does not match ledger entry ID"
        )

    if data.deviceId != device_id:
        raise SyncConflictException(
            "Ledger entry device does not match pushing device"
        )

    if data.amount <= 0:
        raise SyncConflictException(
            "Ledger entry amount must be greater than zero"
        )

    existing = ledger_repository.get_by_id(
        data.id
    )

    if existing is not None:
        raise SyncConflictException(
            f"Ledger entry {data.id} already exists"
        )

    customer = customer_repository.get_by_id_and_shop(
        customer_id=data.customerId,
        shop_id=shop_id,
    )

    if customer is None:
        raise SyncConflictException(
            f"Customer {data.customerId} does not exist"
        )

    device = device_repository.get_by_id_and_shop(
        device_id=device_id,
        shop_id=shop_id,
    )

    if device is None:
        raise SyncConflictException(
            f"Device {device_id} does not exist"
        )

    if data.type == LedgerEntryType.UDHAAR:
        _validate_udhaar_items(
            shop_id=shop_id,
            ledger_entry_id=data.id,
            items=items,
            item_repository=item_repository,
        )

    elif data.type == LedgerEntryType.PAYMENT:
        if items:
            raise SyncConflictException(
                "Payment ledger entries cannot contain items"
            )

    else:
        raise SyncConflictException(
            f"Unsupported ledger entry type: {data.type}"
        )

    entry = ledger_repository.create(
        entry_id=data.id,
        customer_id=data.customerId,
        device_id=device_id,
        entry_type=LedgerEntryType(data.type),
        amount=data.amount,
        note=data.note,
        occurred_at=data.occurredAt,
    )

    for item_data in items:
        entry_item_repository.create(
            entry_item_id=item_data.id,
            ledger_entry_id=entry.id,
            item_id=item_data.itemId,
            name=item_data.itemName.strip(),
            amount=item_data.amount,
        )


def _validate_udhaar_items(
    *,
    shop_id: UUID,
    ledger_entry_id: UUID,
    items,
    item_repository: ItemRepository,
) -> None:
    for item in items:
        if item.ledgerEntryId != ledger_entry_id:
            raise SyncConflictException(
                "Entry item belongs to another ledger entry"
            )

        if not item.itemName.strip():
            raise SyncConflictException(
                "Entry item name is required"
            )

        if item.itemId is None:
            continue

        catalog_item = item_repository.get_by_id_and_shop(
            item_id=item.itemId,
            shop_id=shop_id,
        )

        if catalog_item is None:
            raise SyncConflictException(
                f"Item not found: {item.itemId}"
            )