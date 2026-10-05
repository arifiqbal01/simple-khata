from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    ValidationException,
)
from app.models.enums import LedgerEntryType
from app.models.ledger_entry import LedgerEntry
from app.repositories.customer import CustomerRepository
from app.repositories.device import DeviceRepository
from app.repositories.entry_item import EntryItemRepository
from app.repositories.item import ItemRepository
from app.repositories.ledger_entry import LedgerEntryRepository
from app.schemas.ledger_entry import UdhaarCreate


class CreateUdhaarService:
    def __init__(
        self,
        db: Session,
        ledger_repository: LedgerEntryRepository,
        entry_item_repository: EntryItemRepository,
        item_repository: ItemRepository,
        customer_repository: CustomerRepository,
        device_repository: DeviceRepository,
    ) -> None:
        self.db = db
        self.ledger_repository = ledger_repository
        self.entry_item_repository = entry_item_repository
        self.item_repository = item_repository
        self.customer_repository = customer_repository
        self.device_repository = device_repository

    def execute(
        self,
        *,
        shop_id: UUID,
        data: UdhaarCreate,
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

        if data.items:
            item_total = sum(
                item.amount
                for item in data.items
            )

            if item_total != data.amount:
                raise ValidationException(
                    "Item total must equal ledger entry amount"
                )

        # Validate catalog items before creating anything.
        for item in data.items:
            if item.item_id is None:
                continue

            catalog_item = self.item_repository.get_by_id_and_shop(
                item_id=item.item_id,
                shop_id=shop_id,
            )

            if catalog_item is None:
                raise NotFoundException(
                    f"Item not found: {item.item_id}"
                )

        try:
            entry = self.ledger_repository.create(
                entry_id=data.id,
                customer_id=data.customer_id,
                device_id=data.device_id,
                entry_type=LedgerEntryType.UDHAAR,
                amount=data.amount,
                note=data.note,
                occurred_at=data.occurred_at,
            )

            for item in data.items:
                self.entry_item_repository.create(
                    entry_item_id=item.id,
                    ledger_entry_id=entry.id,
                    item_id=item.item_id,
                    name=item.name.strip(),
                    amount=item.amount,
                )

            self.db.commit()

            saved_entry = self.ledger_repository.get_by_id(
                entry.id,
            )

            if saved_entry is None:
                raise RuntimeError(
                    "Ledger entry could not be loaded after creation"
                )

            return saved_entry

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Ledger entry conflicts with an existing record"
            ) from exc