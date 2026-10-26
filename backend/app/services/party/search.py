
from uuid import UUID

from app.models.enums import PartyType
from app.models.party import Party
from app.repositories.party_repository import PartyRepository


class SearchPartiesService:
    def __init__(
        self,
        repository: PartyRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        query: str | None = None,
        party_type: PartyType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Party]:
        if query is None or not query.strip():
            return self.repository.list_by_shop(
                shop_id=shop_id,
                party_type=party_type,
                limit=limit,
                offset=offset,
            )

        return self.repository.search(
            shop_id=shop_id,
            query=query.strip(),
            party_type=party_type,
            limit=limit,
            offset=offset,
        )
