from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.enums import LedgerEntryType
from app.models.ledger_entry import LedgerEntry
from app.repositories.customer import CustomerRepository
from app.repositories.device import DeviceRepository
from app.repositories.ledger_entry import LedgerEntryRepository
from app.schemas.ledger_entry import PaymentCreate


class RecordPaymentService:
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
        data: PaymentCreate,
    ) -> LedgerEntry:
        customer = self.customer_repository.get_by_id_and_shop(
            customer_id=data.customer_id,
            shop_id=shop_id,
        )

        if customer is None:
            raise NotFoundException("Customer not found")

        device = self.device_repository.get_by_id_and_shop(
            device_id=data.device_id,
            shop_id=shop_id,
        )

        if device is None:
            raise NotFoundException("Device not found")

        try:
            entry = self.ledger_repository.create(
                entry_id=data.id,
                customer_id=data.customer_id,
                device_id=data.device_id,
                entry_type=LedgerEntryType.PAYMENT,
                amount=data.amount,
                note=data.note,
                occurred_at=data.occurred_at,
            )

            self.db.commit()

            return self.ledger_repository.get_by_id(entry.id)

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Payment conflicts with an existing record"
            ) from exc