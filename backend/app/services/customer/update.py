from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException, NotFoundException
from app.models.customer import Customer
from app.repositories.customer import CustomerRepository
from app.schemas.customer import CustomerUpdate
from app.services.customer.utils import normalize_phone


class UpdateCustomerService:
    def __init__(
        self,
        db: Session,
        repository: CustomerRepository,
    ) -> None:
        self.db = db
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        customer_id: UUID,
        data: CustomerUpdate,
    ) -> Customer:
        customer = self.repository.get_by_id_and_shop(
            customer_id=customer_id,
            shop_id=shop_id,
        )

        if customer is None:
            raise NotFoundException("Customer not found")

        values = data.model_dump(exclude_unset=True)

        if "name" in values:
            values["name"] = values["name"].strip()

        if "phone" in values:
            values["phone"] = normalize_phone(values["phone"])

            phone = values["phone"]

            if phone is not None:
                existing = self.repository.get_by_phone(
                    shop_id=shop_id,
                    phone=phone,
                )

                if (
                    existing is not None
                    and existing.id != customer.id
                ):
                    raise ConflictException(
                        "A customer with this phone number already exists"
                    )

        try:
            customer = self.repository.update(
                customer,
                values=values,
            )

            self.db.commit()

            return customer

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Customer could not be updated because it conflicts "
                "with an existing record"
            ) from exc