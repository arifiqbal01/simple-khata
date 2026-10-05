from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer


class CustomerRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        customer_id: UUID,
        shop_id: UUID,
        name: str,
        phone: str | None = None,
    ) -> Customer:
        customer = Customer(
            id=customer_id,
            shop_id=shop_id,
            name=name,
            phone=phone,
        )

        self.db.add(customer)
        self.db.flush()
        self.db.refresh(customer)

        return customer

    def get_by_id(
        self,
        customer_id: UUID,
    ) -> Customer | None:
        return self.db.get(Customer, customer_id)

    def get_by_id_and_shop(
        self,
        *,
        customer_id: UUID,
        shop_id: UUID,
    ) -> Customer | None:
        statement = select(Customer).where(
            Customer.id == customer_id,
            Customer.shop_id == shop_id,
        )

        return self.db.scalar(statement)

    def get_by_phone(
        self,
        *,
        shop_id: UUID,
        phone: str,
    ) -> Customer | None:
        statement = select(Customer).where(
            Customer.shop_id == shop_id,
            Customer.phone == phone,
        )

        return self.db.scalar(statement)

    def list_by_shop(
        self,
        *,
        shop_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Customer]:
        statement = (
            select(Customer)
            .where(Customer.shop_id == shop_id)
            .order_by(Customer.name, Customer.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def search(
        self,
        *,
        shop_id: UUID,
        query: str,
        limit: int = 50,
    ) -> list[Customer]:
        pattern = f"%{query}%"

        statement = (
            select(Customer)
            .where(
                Customer.shop_id == shop_id,
                Customer.name.ilike(pattern),
            )
            .order_by(Customer.name, Customer.id)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def update(
            self,
            customer: Customer,
            *,
            values: dict[str, object],
    ) -> Customer:
        for field, value in values.items():
            setattr(customer, field, value)

        self.db.flush()

        return customer