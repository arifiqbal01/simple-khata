from uuid import UUID

from app.core.exceptions import NotFoundException
from app.models.customer import Customer
from app.repositories.customer import CustomerRepository


class GetCustomerService:
    def __init__(
        self,
        repository: CustomerRepository,
    ) -> None:
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        customer_id: UUID,
    ) -> Customer:
        customer = self.repository.get_by_id_and_shop(
            customer_id=customer_id,
            shop_id=shop_id,
        )

        if customer is None:
            raise NotFoundException("Customer not found")

        return customer