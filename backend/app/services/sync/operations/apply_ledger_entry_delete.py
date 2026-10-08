from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.repositories.customer import CustomerRepository
from app.repositories.device import DeviceRepository
from app.repositories.ledger_entry import LedgerEntryRepository
from app.schemas.sync import LedgerEntryDeleteOperation


def apply_ledger_entry_delete(
    db: Session,
    *,
    shop_id: UUID,
    device_id: UUID,
    operation: LedgerEntryDeleteOperation,
) -> None:
    data = operation.payload.entry

    if operation.entityId != data.id:
        raise ConflictException("Ledger entry ID mismatch")

    if data.deletedByDeviceId != device_id:
        raise ConflictException("Deleting device ID mismatch")

    device_repository = DeviceRepository(db)
    customer_repository = CustomerRepository(db)
    ledger_repository = LedgerEntryRepository(db)

    device = device_repository.get_by_id_and_shop(
        device_id=device_id,
        shop_id=shop_id,
    )

    if device is None:
        raise NotFoundException("Device not found")

    entry = ledger_repository.get_by_id(data.id)

    if entry is None:
        raise NotFoundException("Ledger entry not found")

    customer = customer_repository.get_by_id_and_shop(
        customer_id=entry.customer_id,
        shop_id=shop_id,
    )

    if customer is None:
        raise NotFoundException("Ledger entry not found")

    if entry.deleted_at is not None:
        return

    ledger_repository.soft_delete(
        entry=entry,
        deleted_at=data.deletedAt,
        deleted_by_device_id=device_id,
    )