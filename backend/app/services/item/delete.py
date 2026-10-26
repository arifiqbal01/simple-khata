
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.repositories.item import ItemRepository


class DeleteItemService:
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
        item_id: UUID,
        device_id: UUID,
    ) -> bool:
        try:
            item = self.repository.get_by_id_and_shop(
                item_id=item_id,
                shop_id=shop_id,
                include_deleted=True,
            )

            if item is None:
                raise NotFoundException("Item not found")

            if item.deleted_at is not None:
                return False

            self.repository.soft_delete(
                item=item,
                device_id=device_id,
            )

            self.db.commit()

            return True

        except IntegrityError:
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            raise