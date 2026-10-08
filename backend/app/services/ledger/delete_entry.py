from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.ledger_entry import LedgerEntry
from app.repositories.customer import CustomerRepository
from app.repositories.device import DeviceRepository
from app.repositories.ledger_entry import LedgerEntryRepository


class DeleteLedgerEntryService:
    def __init__(
        self,
        db: Session,
        ledger_repository: LedgerEntryRepository,
        customer_repository: CustomerRepository,
        device_repository: DeviceRepository,
    ) -> None:
        self.db = db
        self.ledger_repository = ledger_repository
        self.customer_repository = customer_repository
        self.device_repository = device_repository

    def execute(
        self,
        *,
        shop_id: UUID,
        entry_id: UUID,
        device_id: UUID,
        deleted_at: datetime,
    ) -> LedgerEntry:
        entry = self.ledger_repository.get_by_id(entry_id)

        if entry is None:
            raise NotFoundException("Ledger entry not found")

        customer = self.customer_repository.get_by_id_and_shop(
            customer_id=entry.customer_id,
            shop_id=shop_id,
        )

        if customer is None:
            raise NotFoundException("Ledger entry not found")

        device = self.device_repository.get_by_id_and_shop(
            device_id=device_id,
            shop_id=shop_id,
        )

        if device is None:
            raise NotFoundException("Device not found")

        # Entity-level idempotency:
        # deleting an already-deleted entry is a no-op.
        if entry.deleted_at is not None:
            return entry

        try:
            self.ledger_repository.soft_delete(
                entry=entry,
                deleted_at=deleted_at,
                deleted_by_device_id=device_id,
            )

            self.db.commit()

            saved_entry = self.ledger_repository.get_by_id(entry.id)

            if saved_entry is None:
                raise RuntimeError(
                    "Ledger entry could not be loaded after deletion"
                )

            return saved_entry

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Ledger entry could not be deleted"
            ) from exc