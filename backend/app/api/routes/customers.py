from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_shop_id
from app.db.session import get_db
from app.models.customer import Customer
from app.repositories.customer import CustomerRepository
from app.schemas.customer import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
)
from app.services.customer import (
    CreateCustomerService,
    GetCustomerService,
    SearchCustomersService,
    UpdateCustomerService,
)

router = APIRouter(prefix="/customers")

@router.post(
    "",
    response_model=CustomerRead,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    data: CustomerCreate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Customer:
    repository = CustomerRepository(db)

    service = CreateCustomerService(
        db=db,
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        data=data,
    )


@router.get(
    "",
    response_model=list[CustomerRead],
)
def list_customers(
    query: str | None = Query(
        default=None,
        max_length=150,
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> list[Customer]:
    repository = CustomerRepository(db)

    service = SearchCustomersService(
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        query=query,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{customer_id}",
    response_model=CustomerRead,
)
def get_customer(
    customer_id: UUID,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Customer:
    repository = CustomerRepository(db)

    service = GetCustomerService(
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        customer_id=customer_id,
    )


@router.patch(
    "/{customer_id}",
    response_model=CustomerRead,
)
def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> Customer:
    repository = CustomerRepository(db)

    service = UpdateCustomerService(
        db=db,
        repository=repository,
    )

    return service.execute(
        shop_id=shop_id,
        customer_id=customer_id,
        data=data,
    )