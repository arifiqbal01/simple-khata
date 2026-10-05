from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException
from app.models.item import Item
from app.repositories.item import ItemRepository
from app.schemas.item import ItemCreate


class CreateItemService:
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
        data: ItemCreate,
    ) -> Item:
        try:
            item = self.repository.create(
                item_id=data.id,
                shop_id=shop_id,
                name=data.name,
            )

            self.db.commit()

            return item

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Item could not be created because it conflicts "
                "with an existing record"
            ) from exc