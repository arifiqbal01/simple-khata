from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException
from app.models.customer import Customer
from app.repositories.customer import CustomerRepository
from app.schemas.customer import CustomerCreate
from app.services.customer.utils import normalize_phone


class CreateCustomerService:
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
        data: CustomerCreate,
    ) -> Customer:
        phone = normalize_phone(data.phone)

        if phone is not None:
            existing = self.repository.get_by_phone(
                shop_id=shop_id,
                phone=phone,
            )

            if existing is not None:
                raise ConflictException(
                    "A customer with this phone number already exists"
                )

        try:
            customer = self.repository.create(
                customer_id=data.id,
                shop_id=shop_id,
                name=data.name.strip(),
                phone=phone,
            )

            self.db.commit()
            self.db.refresh(customer)

            return customer

        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictException(
                "Customer could not be created because it conflicts "
                "with an existing record"
            ) from exc