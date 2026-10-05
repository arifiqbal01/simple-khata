from uuid import UUID

from app.core.exceptions import NotFoundException
from app.models.item import Item
from app.repositories.item import ItemRepository


class GetItemService:
    def __init__(
        self,
        repository: ItemRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        item_id: UUID,
    ) -> Item:
        item = self.repository.get_by_id_and_shop(
            item_id=item_id,
            shop_id=shop_id,
        )

        if item is None:
            raise NotFoundException("Item not found")

        return item