from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.repositories.customer import CustomerRepository
from app.schemas.sync import (
    CustomerCreateOperation,
    CustomerUpdateOperation,
)
from app.services.customer.utils import normalize_phone


def _validate_customer_operation(
    *,
    shop_id: UUID,
    operation: CustomerCreateOperation | CustomerUpdateOperation,
) -> None:
    customer = operation.payload.customer

    if operation.entityId != customer.id:
        raise SyncConflictException(
            "Operation entity ID does not match customer ID"
        )

    if customer.shopId != shop_id:
        raise SyncConflictException(
            "Customer belongs to another shop"
        )


def apply_customer_create(
    db: Session,
    *,
    shop_id: UUID,
    operation: CustomerCreateOperation,
) -> None:
    _validate_customer_operation(
        shop_id=shop_id,
        operation=operation,
    )

    repository = CustomerRepository(db)
    data = operation.payload.customer

    existing = repository.get_by_id(data.id)

    if existing is not None:
        raise SyncConflictException(
            f"Customer {data.id} already exists"
        )

    phone = normalize_phone(data.phone)

    if phone is not None:
        existing_by_phone = repository.get_by_phone(
            shop_id=shop_id,
            phone=phone,
        )

        if existing_by_phone is not None:
            raise SyncConflictException(
                "A customer with this phone number already exists"
            )

    repository.create(
        customer_id=data.id,
        shop_id=shop_id,
        name=data.name.strip(),
        phone=phone,
    )


def apply_customer_update(
    db: Session,
    *,
    shop_id: UUID,
    operation: CustomerUpdateOperation,
) -> None:
    _validate_customer_operation(
        shop_id=shop_id,
        operation=operation,
    )

    repository = CustomerRepository(db)
    data = operation.payload.customer

    customer = repository.get_by_id_and_shop(
        customer_id=data.id,
        shop_id=shop_id,
    )

    if customer is None:
        raise SyncConflictException(
            f"Customer {data.id} does not exist"
        )

    phone = normalize_phone(data.phone)

    if phone is not None:
        existing_by_phone = repository.get_by_phone(
            shop_id=shop_id,
            phone=phone,
        )

        if (
            existing_by_phone is not None
            and existing_by_phone.id != customer.id
        ):
            raise SyncConflictException(
                "A customer with this phone number already exists"
            )

    repository.update(
        customer,
        values={
            "name": data.name.strip(),
            "phone": phone,
        },
    )