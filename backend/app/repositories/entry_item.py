
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entry_item import EntryItem


class EntryItemRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        entry_item_id: UUID,
        ledger_entry_id: UUID,
        name: str,
        amount: int | None = None,
        item_id: UUID | None = None,
        quantity: Decimal | None = None,
        unit: str | None = None,
        unit_price: int | None = None,
    ) -> EntryItem:
        if quantity is not None:
            if not quantity.is_finite() or quantity <= 0:
                raise ValueError(
                    "quantity must be a positive finite number"
                )

            if quantity.as_tuple().exponent < -3:
                raise ValueError(
                    "quantity cannot have more than 3 decimal places"
                )

            if quantity >= Decimal("1000000000"):
                raise ValueError(
                    "quantity exceeds the supported range"
                )

        if unit_price is not None and unit_price < 0:
            raise ValueError(
                "unit_price cannot be negative"
            )

        if amount is None:
            if quantity is None or unit_price is None:
                raise ValueError(
                    "Provide amount or both quantity and unit_price"
                )

            amount = int(
                (quantity * Decimal(unit_price)).quantize(
                    Decimal("1"),
                    rounding=ROUND_HALF_UP,
                )
            )

        if amount <= 0:
            raise ValueError(
                "amount must be greater than zero"
            )

        entry_item = EntryItem(
            id=entry_item_id,
            ledger_entry_id=ledger_entry_id,
            item_id=item_id,
            name=name,
            amount=amount,
            quantity=quantity,
            unit=unit,
            unit_price=unit_price,
        )

        self.db.add(entry_item)
        self.db.flush()

        return entry_item

    def list_by_ledger_entry(
        self,
        *,
        ledger_entry_id: UUID,
    ) -> list[EntryItem]:
        statement = (
            select(EntryItem)
            .where(
                EntryItem.ledger_entry_id == ledger_entry_id,
            )
            .order_by(EntryItem.id)
        )

        return list(self.db.scalars(statement).all())