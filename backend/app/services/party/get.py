
from uuid import UUID

from app.core.exceptions import NotFoundException
from app.models.party import Party
from app.repositories.party_repository import PartyRepository


class GetPartyService:
    def __init__(
        self,
        repository: PartyRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        party_id: UUID,
    ) -> Party:
        party = self.repository.get_by_id_and_shop(
            party_id=party_id,
            shop_id=shop_id,
        )

        if party is None:
            raise NotFoundException("Party not found")

        return party
