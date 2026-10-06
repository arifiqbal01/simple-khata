from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncValidationException
from app.repositories.sync import SyncRepository
from app.schemas.sync import (
    SyncChange,
    SyncPullResponse,
)
from app.services.sync.identity import validate_sync_identity


class PullSyncService:
    def __init__(
        self,
        db: Session,
        repository: SyncRepository,
    ) -> None:
        self.db = db
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        device_id: UUID,
        cursor: int,
        limit: int = 100,
    ) -> SyncPullResponse:
        if cursor < 0:
            raise SyncValidationException(
                "Cursor cannot be negative"
            )

        if limit < 1 or limit > 100:
            raise SyncValidationException(
                "Pull limit must be between 1 and 100"
            )

        validate_sync_identity(
            self.db,
            shop_id=shop_id,
            device_id=device_id,
        )

        rows = self.repository.get_changes_after_cursor(
            shop_id=shop_id,
            cursor=cursor,
            limit=limit + 1,
        )

        has_more = len(rows) > limit
        rows = rows[:limit]

        changes = [
            SyncChange(
                sequence=row.sequence,
                entityType=row.entity_type,
                entityId=row.entity_id,
                operationType=row.operation_type,
                payload=row.payload,
                createdAt=row.created_at,
            )
            for row in rows
        ]

        next_cursor = (
            rows[-1].sequence
            if rows
            else cursor
        )

        return SyncPullResponse(
            changes=changes,
            nextCursor=next_cursor,
            hasMore=has_more,
        )