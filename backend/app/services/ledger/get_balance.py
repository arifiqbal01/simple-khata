from uuid import UUID

from app.core.exceptions import NotFoundException
from app.repositories.customer import CustomerRepository
from app.repositories.ledger_entry import LedgerEntryRepository


class GetCustomerBalanceService:
    def __init__(
        self,
        ledger_repository: LedgerEntryRepository,
        customer_repository: CustomerRepository,
    ) -> None:
        self.ledger_repository = ledger_repository
        self.customer_repository = customer_repository

    def execute(
        self,
        *,
        shop_id: UUID,
        customer_id: UUID,
    ) -> int:
        customer = self.customer_repository.get_by_id_and_shop(
            customer_id=customer_id,
            shop_id=shop_id,
        )

        if customer is None:
            raise NotFoundException("Customer not found")

        return self.ledger_repository.get_balance(
            customer_id=customer_id,
        )