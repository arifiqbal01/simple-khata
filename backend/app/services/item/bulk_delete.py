
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.repositories.item import ItemRepository
from app.schemas.item import (
    ItemBulkDelete,
    ItemBulkDeleteResult,
)


class BulkDeleteItemsService:
    def __init__(
        self,
        db: Session,
        repository: ItemRepository,
    ) -> None:
        self.db = db
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        device_id: UUID,
        data: ItemBulkDelete,
    ) -> ItemBulkDeleteResult:
        item_ids = list(dict.fromkeys(data.item_ids))

        try:
            existing_items = [
                self.repository.get_by_id_and_shop(
                    item_id=item_id,
                    shop_id=shop_id,
                    include_deleted=True,
                )
                for item_id in item_ids
            ]

            if any(item is None for item in existing_items):
                raise NotFoundException(
                    "One or more item were not found"
                )

            already_deleted_count = sum(
                item.deleted_at is not None
                for item in existing_items
            )

            deleted_items = self.repository.bulk_soft_delete(
                shop_id=shop_id,
                item_ids=item_ids,
                device_id=device_id,
            )

            self.db.commit()

            return ItemBulkDeleteResult(
                deleted_count=len(deleted_items),
                already_deleted_count=already_deleted_count,
            )

        except ValueError as exc:
            self.db.rollback()
            raise NotFoundException(
                "One or more item were not found"
            ) from exc

        except Exception:
            self.db.rollback()
            raise