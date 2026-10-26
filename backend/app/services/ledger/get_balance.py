
from uuid import UUID

from app.core.exceptions import NotFoundException
from app.repositories.party_repository import PartyRepository
from app.repositories.ledger_entry import LedgerEntryRepository


class GetPartyBalanceService:
    def __init__(
        self,
        ledger_repository: LedgerEntryRepository,
        party_repository: PartyRepository,
    ) -> None:
        self.ledger_repository = ledger_repository
        self.party_repository = party_repository

    def execute(
        self,
        *,
        shop_id: UUID,
        party_id: UUID,
    ) -> int:
        party = self.party_repository.get_by_id_and_shop(
            party_id=party_id,
            shop_id=shop_id,
        )

        if party is None:
            raise NotFoundException("Party not found")

        return self.ledger_repository.get_balance(
            party_id=party_id,
        )
