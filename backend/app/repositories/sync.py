from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sync_change import SyncChange
from app.models.sync_operation import SyncOperation


class SyncRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_operation(
        self,
        operation_id: UUID,
    ) -> SyncOperation | None:
        statement = select(SyncOperation).where(
            SyncOperation.id == operation_id
        )

        return self.db.scalar(statement)

    def operation_exists(
        self,
        operation_id: UUID,
    ) -> bool:
        statement = (
            select(SyncOperation.id)
            .where(
                SyncOperation.id == operation_id
            )
            .limit(1)
        )

        return self.db.scalar(statement) is not None

    def add_processed_operation(
        self,
        *,
        operation_id: UUID,
        shop_id: UUID,
        device_id: UUID,
        operation_type: str,
        entity_type: str,
        entity_id: UUID,
    ) -> SyncOperation:
        operation = SyncOperation(
            id=operation_id,
            shop_id=shop_id,
            device_id=device_id,
            operation_type=operation_type,
            entity_type=entity_type,
            entity_id=entity_id,
        )

        self.db.add(operation)
        self.db.flush()

        return operation

    def get_operations_by_ids(
        self,
        operation_ids: list[UUID],
    ) -> list[SyncOperation]:
        if not operation_ids:
            return []

        statement = select(SyncOperation).where(
            SyncOperation.id.in_(operation_ids)
        )

        return list(
            self.db.scalars(statement).all()
        )

    def add_change(
        self,
        *,
        shop_id: UUID,
        operation_id: UUID,
        entity_type: str,
        entity_id: UUID,
        operation_type: str,
        payload: dict,
    ) -> SyncChange:
        change = SyncChange(
            shop_id=shop_id,
            operation_id=operation_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operation_type=operation_type,
            payload=payload,
        )

        self.db.add(change)
        self.db.flush()

        return change

    def get_changes_after_cursor(
        self,
        *,
        shop_id: UUID,
        cursor: int,
        limit: int,
    ) -> list[SyncChange]:
        statement = (
            select(SyncChange)
            .where(
                SyncChange.shop_id == shop_id,
                SyncChange.sequence > cursor,
            )
            .order_by(
                SyncChange.sequence.asc()
            )
            .limit(limit)
        )

        return list(
            self.db.scalars(statement).all()
        )