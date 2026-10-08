from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.models.sync_operation import SyncOperation
from app.repositories.ledger_entry import LedgerEntryRepository
from app.repositories.sync import SyncRepository
from app.schemas.sync import (
    CustomerCreateOperation,
    CustomerUpdateOperation,
    ItemCreateOperation,
    ItemUpdateOperation,
    LedgerEntryCreateOperation,
    LedgerEntryDeleteOperation,
    LedgerEntryDeletePayload,
    SyncPushOperation,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync.identity import validate_sync_identity
from app.services.sync.operations.customer import (
    apply_customer_create,
    apply_customer_update,
)
from app.services.sync.operations.item import (
    apply_item_create,
    apply_item_update,
)
from app.services.sync.operations import (
    apply_ledger_entry_create,
    apply_ledger_entry_delete,
)


class PushSyncService:
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
        data: SyncPushRequest,
    ) -> SyncPushResponse:
        validate_sync_identity(
            self.db,
            shop_id=data.shopId,
            device_id=data.deviceId,
        )

        acknowledged_operation_ids: list[UUID] = []
        current_operation: SyncPushOperation | None = None

        try:
            for operation in data.operations:
                current_operation = operation

                existing = self.repository.get_operation(
                    operation.id
                )

                if existing is not None:
                    self._validate_retry(
                        existing=existing,
                        request=data,
                        operation=operation,
                    )

                    acknowledged_operation_ids.append(
                        operation.id
                    )
                    continue

                self._apply_operation(
                    shop_id=data.shopId,
                    device_id=data.deviceId,
                    operation=operation,
                )

                # Normally sync changes contain the submitted payload.
                change_payload = operation.payload.model_dump(
                    mode="json"
                )

                # For deletions, publish the canonical tombstone
                # stored in PostgreSQL, not necessarily the incoming
                # device's deletion metadata.
                if isinstance(
                    operation,
                    LedgerEntryDeleteOperation,
                ):
                    entry = LedgerEntryRepository(
                        self.db
                    ).get_by_id(operation.entityId)

                    if entry is None or entry.deleted_at is None:
                        raise SyncConflictException(
                            "Deleted ledger entry could not be loaded"
                        )

                    if entry.deleted_by_device_id is None:
                        raise SyncConflictException(
                            "Deleting device is missing"
                        )

                    change_payload = LedgerEntryDeletePayload(
                        entry={
                            "id": entry.id,
                            "deletedAt": entry.deleted_at,
                            "deletedByDeviceId": (
                                entry.deleted_by_device_id
                            ),
                        }
                    ).model_dump(mode="json")

                self.repository.add_processed_operation(
                    operation_id=operation.id,
                    shop_id=data.shopId,
                    device_id=data.deviceId,
                    operation_type=operation.operationType.value,
                    entity_type=operation.entityType.value,
                    entity_id=operation.entityId,
                )

                self.repository.add_change(
                    shop_id=data.shopId,
                    operation_id=operation.id,
                    entity_type=operation.entityType.value,
                    entity_id=operation.entityId,
                    operation_type=operation.operationType.value,
                    payload=change_payload,
                )

                acknowledged_operation_ids.append(
                    operation.id
                )

            self.db.commit()

        except IntegrityError as exc:
            self.db.rollback()

            operation_id = (
                str(current_operation.id)
                if current_operation is not None
                else "unknown"
            )

            operation_type = (
                current_operation.operationType.value
                if current_operation is not None
                else "unknown"
            )

            entity_id = (
                str(current_operation.entityId)
                if current_operation is not None
                else "unknown"
            )

            detail = (
                str(exc.orig)
                if exc.orig is not None
                else str(exc)
            )

            raise SyncConflictException(
                "Sync operation conflicts with an existing record. "
                f"operationId={operation_id}, "
                f"operationType={operation_type}, "
                f"entityId={entity_id}. "
                f"Database error: {detail}"
            ) from exc

        except Exception:
            self.db.rollback()
            raise

        return SyncPushResponse(
            acknowledgedOperationIds=acknowledged_operation_ids,
        )

    def _apply_operation(
        self,
        *,
        shop_id: UUID,
        device_id: UUID,
        operation: SyncPushOperation,
    ) -> None:
        if isinstance(operation, CustomerCreateOperation):
            apply_customer_create(
                self.db,
                shop_id=shop_id,
                operation=operation,
            )
            return

        if isinstance(operation, CustomerUpdateOperation):
            apply_customer_update(
                self.db,
                shop_id=shop_id,
                operation=operation,
            )
            return

        if isinstance(operation, ItemCreateOperation):
            apply_item_create(
                self.db,
                shop_id=shop_id,
                operation=operation,
            )
            return

        if isinstance(operation, ItemUpdateOperation):
            apply_item_update(
                self.db,
                shop_id=shop_id,
                operation=operation,
            )
            return

        if isinstance(operation, LedgerEntryCreateOperation):
            apply_ledger_entry_create(
                self.db,
                shop_id=shop_id,
                device_id=device_id,
                operation=operation,
            )
            return

        if isinstance(operation, LedgerEntryDeleteOperation):
            apply_ledger_entry_delete(
                self.db,
                shop_id=shop_id,
                device_id=device_id,
                operation=operation,
            )
            return

        raise SyncConflictException(
            f"Unsupported sync operation: "
            f"{operation.operationType}"
        )

    @staticmethod
    def _validate_retry(
        *,
        existing: SyncOperation,
        request: SyncPushRequest,
        operation: SyncPushOperation,
    ) -> None:
        if existing.shop_id != request.shopId:
            raise SyncConflictException(
                "Operation ID already belongs to another shop"
            )

        if existing.device_id != request.deviceId:
            raise SyncConflictException(
                "Operation ID already belongs to another device"
            )

        if (
            existing.operation_type
            != operation.operationType.value
        ):
            raise SyncConflictException(
                "Operation ID reused with a different "
                "operation type"
            )

        if (
            existing.entity_type
            != operation.entityType.value
        ):
            raise SyncConflictException(
                "Operation ID reused with a different "
                "entity type"
            )

        if existing.entity_id != operation.entityId:
            raise SyncConflictException(
                "Operation ID reused with a different entity"
            )