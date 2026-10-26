
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
        party_id: UUID,
        device_id: UUID,
        entry_type: LedgerEntryType,
        amount: int,
        occurred_at: datetime,
        note: str | None = None,
    ) -> LedgerEntry:
        entry = LedgerEntry(
            id=entry_id,
            party_id=party_id,
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
        *,
        include_deleted: bool = True,
    ) -> LedgerEntry | None:
        statement = (
            select(LedgerEntry)
            .options(selectinload(LedgerEntry.line_items))
            .where(LedgerEntry.id == entry_id)
        )

        if not include_deleted:
            statement = statement.where(
                LedgerEntry.deleted_at.is_(None)
            )

        return self.db.scalar(statement)

    def list_by_party(
        self,
        *,
        party_id: UUID,
        limit: int = 100,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> list[LedgerEntry]:
        statement = (
            select(LedgerEntry)
            .options(selectinload(LedgerEntry.line_items))
            .where(LedgerEntry.party_id == party_id)
        )

        if not include_deleted:
            statement = statement.where(
                LedgerEntry.deleted_at.is_(None)
            )

        statement = (
            statement
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
        party_id: UUID,
    ) -> int:
        signed_amount = case(
            (
                LedgerEntry.type.in_(
                    [
                        LedgerEntryType.UDHAAR,
                        LedgerEntryType.SUPPLY,
                    ]
                ),
                LedgerEntry.amount,
            ),
            (
                LedgerEntry.type == LedgerEntryType.PAYMENT,
                -LedgerEntry.amount,
            ),
            else_=0,
        )

        statement = select(
            func.coalesce(
                func.sum(signed_amount),
                0,
            )
        ).where(
            LedgerEntry.party_id == party_id,
            LedgerEntry.deleted_at.is_(None),
        )

        return int(self.db.scalar(statement) or 0)

    def soft_delete(
        self,
        *,
        entry: LedgerEntry,
        deleted_at: datetime,
        deleted_by_device_id: UUID,
    ) -> LedgerEntry:
        if entry.deleted_at is not None:
            return entry

        if (
            deleted_at.tzinfo is None
            or deleted_at.utcoffset() is None
        ):
            raise ValueError(
                "deleted_at must be timezone-aware"
            )

        entry.deleted_at = deleted_at
        entry.deleted_by_device_id = deleted_by_device_id

        self.db.flush()

        return entry