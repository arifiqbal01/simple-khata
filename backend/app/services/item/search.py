from uuid import UUID

from app.models.item import Item
from app.repositories.item import ItemRepository


class SearchItemsService:
    def __init__(
        self,
        repository: ItemRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Item]:
        if query is None or not query.strip():
            return self.repository.list_by_shop(
                shop_id=shop_id,
                limit=limit,
                offset=offset,
            )

        return self.repository.search(
            shop_id=shop_id,
            query=query.strip(),
            limit=limit,
            offset=offset,
        )