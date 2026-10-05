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
        amount: int,
        item_id: UUID | None = None,
    ) -> EntryItem:
        entry_item = EntryItem(
            id=entry_item_id,
            ledger_entry_id=ledger_entry_id,
            item_id=item_id,
            name=name,
            amount=amount,
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