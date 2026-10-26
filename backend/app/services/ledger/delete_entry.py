
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.ledger_entry import LedgerEntry
from app.repositories.party_repository import PartyRepository
from app.repositories.device import DeviceRepository
from app.repositories.ledger_entry import LedgerEntryRepository


class DeleteLedgerEntryService:
    def __init__(
        self,
        db: Session,
        ledger_repository: LedgerEntryRepository,
        party_repository: PartyRepository,
        device_repository: DeviceRepository,
    ) -> None:
        self.db = db
        self.ledger_repository = ledger_repository
        self.party_repository = party_repository
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

        # Include deleted parties so existing ledger entries
        # can still be resolved and deleted.
        party = self.party_repository.get_by_id_and_shop(
            party_id=entry.party_id,
            shop_id=shop_id,
            include_deleted=True,
        )

        if party is None:
            raise NotFoundException("Ledger entry not found")

        device = self.device_repository.get_by_id_and_shop(
            device_id=device_id,
            shop_id=shop_id,
        )

        if device is None:
            raise NotFoundException("Device not found")

        # Idempotency: deleting an already-deleted entry
        # must not overwrite its original deletion metadata.
        if entry.deleted_at is not None:
            return entry

        try:
            self.ledger_repository.soft_delete(
                entry=entry,
                deleted_at=deleted_at,
                deleted_by_device_id=device_id,
            )

            self.db.commit()

            saved_entry = self.ledger_repository.get_by_id(
                entry.id,
            )

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