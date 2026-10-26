
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.enums import LedgerEntryType, PartyType
from app.models.ledger_entry import LedgerEntry
from app.repositories.party_repository import PartyRepository
from app.repositories.device import DeviceRepository
from app.repositories.ledger_entry import LedgerEntryRepository
from app.schemas.ledger_entry import PaymentCreate


class RecordPaymentService:
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
        data: PaymentCreate,
    ) -> LedgerEntry:
        party = self.party_repository.get_by_id_and_shop(
            party_id=data.party_id,
            shop_id=shop_id,
        )

        if party is None:
            raise NotFoundException("Party not found")

        if party.type not in (
            PartyType.CUSTOMER,
            PartyType.SUPPLIER,
        ):
            raise ConflictException(
                "Payments can only be recorded for customers or suppliers"
            )

        device = self.device_repository.get_by_id_and_shop(
            device_id=data.device_id,
            shop_id=shop_id,
        )

        if device is None:
            raise NotFoundException("Device not found")

        try:
            entry = self.ledger_repository.create(
                entry_id=data.id,
                party_id=data.party_id,
                device_id=data.device_id,
                entry_type=LedgerEntryType.PAYMENT,
                amount=data.amount,
                note=data.note,
                occurred_at=data.occurred_at,
            )

            self.db.commit()

            saved_entry = self.ledger_repository.get_by_id(
                entry.id,
            )

            if saved_entry is None:
                raise RuntimeError(
                    "Payment could not be loaded after creation"
                )

            return saved_entry

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Payment conflicts with an existing record"
            ) from exc