from datetime import datetime
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import LedgerEntryType
from app.models.ledger_entry import LedgerEntry


class LedgerEntryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        entry_id: UUID,
        customer_id: UUID,
        device_id: UUID,
        entry_type: LedgerEntryType,
        amount: int,
        occurred_at: datetime,
        note: str | None = None,
    ) -> LedgerEntry:
        entry = LedgerEntry(
            id=entry_id,
            customer_id=customer_id,
            device_id=device_id,
            type=entry_type,
            amount=amount,
            note=note,
            occurred_at=occurred_at,
        )

        self.db.add(entry)
        self.db.flush()

        return entry

    def get_by_id(
        self,
        entry_id: UUID,
    ) -> LedgerEntry | None:
        statement = (
            select(LedgerEntry)
            .options(selectinload(LedgerEntry.items))
            .where(LedgerEntry.id == entry_id)
        )

        return self.db.scalar(statement)

    def list_by_customer(
        self,
        *,
        customer_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[LedgerEntry]:
        statement = (
            select(LedgerEntry)
            .options(selectinload(LedgerEntry.items))
            .where(
                LedgerEntry.customer_id == customer_id,
                LedgerEntry.deleted_at.is_(None),
            )
            .order_by(
                LedgerEntry.occurred_at.desc(),
                LedgerEntry.created_at.desc(),
                LedgerEntry.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def get_balance(
        self,
        *,
        customer_id: UUID,
    ) -> int:
        signed_amount = case(
            (
                LedgerEntry.type == LedgerEntryType.UDHAAR,
                LedgerEntry.amount,
            ),
            else_=-LedgerEntry.amount,
        )

        statement = (
            select(
                func.coalesce(
                    func.sum(signed_amount),
                    0,
                )
            )
            .where(
                LedgerEntry.customer_id == customer_id,
                LedgerEntry.deleted_at.is_(None),
            )
        )

        return int(self.db.scalar(statement) or 0)

    def soft_delete(
            self,
            *,
            entry: LedgerEntry,
            deleted_at: datetime,
            deleted_by_device_id: UUID,
    ) -> LedgerEntry:
        entry.deleted_at = deleted_at
        entry.deleted_by_device_id = deleted_by_device_id

        self.db.flush()

        return entry