from uuid import UUID

from app.models.customer import Customer
from app.repositories.customer import CustomerRepository


class SearchCustomersService:
    def __init__(
        self,
        repository: CustomerRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Customer]:
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
        )