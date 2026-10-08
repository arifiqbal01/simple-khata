from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_shop_id
from app.db.session import get_db
from app.models.ledger_entry import LedgerEntry
from app.repositories.customer import CustomerRepository
from app.repositories.device import DeviceRepository
from app.repositories.entry_item import EntryItemRepository
from app.repositories.item import ItemRepository
from app.repositories.ledger_entry import LedgerEntryRepository
from app.schemas.ledger_entry import (
    CustomerBalanceRead,
    LedgerEntryDelete,
    LedgerEntryRead,
    PaymentCreate,
    UdhaarCreate,
)
from app.services.ledger import (
    CreateUdhaarService,
    DeleteLedgerEntryService,
    GetCustomerBalanceService,
    GetLedgerHistoryService,
    RecordPaymentService,
)

router = APIRouter()


@router.post(
    "/ledger/udhaar",
    response_model=LedgerEntryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_udhaar(
    data: UdhaarCreate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> LedgerEntry:
    service = CreateUdhaarService(
        db=db,
        ledger_repository=LedgerEntryRepository(db),
        entry_item_repository=EntryItemRepository(db),
        item_repository=ItemRepository(db),
        customer_repository=CustomerRepository(db),
        device_repository=DeviceRepository(db),
    )

    return service.execute(
        shop_id=shop_id,
        data=data,
    )


@router.post(
    "/ledger/payments",
    response_model=LedgerEntryRead,
    status_code=status.HTTP_201_CREATED,
)
def record_payment(
    data: PaymentCreate,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> LedgerEntry:
    service = RecordPaymentService(
        db=db,
        ledger_repository=LedgerEntryRepository(db),
        customer_repository=CustomerRepository(db),
        device_repository=DeviceRepository(db),
    )

    return service.execute(
        shop_id=shop_id,
        data=data,
    )


@router.get(
    "/customers/{customer_id}/ledger",
    response_model=list[LedgerEntryRead],
)
def get_customer_history(
    customer_id: UUID,
    limit: int = Query(
        default=100,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> list[LedgerEntry]:
    service = GetLedgerHistoryService(
        ledger_repository=LedgerEntryRepository(db),
        customer_repository=CustomerRepository(db),
    )

    return service.execute(
        shop_id=shop_id,
        customer_id=customer_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/customers/{customer_id}/balance",
    response_model=CustomerBalanceRead,
)
def get_customer_balance(
    customer_id: UUID,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> CustomerBalanceRead:
    service = GetCustomerBalanceService(
        ledger_repository=LedgerEntryRepository(db),
        customer_repository=CustomerRepository(db),
    )

    balance = service.execute(
        shop_id=shop_id,
        customer_id=customer_id,
    )

    return CustomerBalanceRead(
        customer_id=customer_id,
        balance=balance,
    )

@router.delete(
    "/ledger/{entry_id}",
    response_model=LedgerEntryRead,
)
def delete_ledger_entry(
    entry_id: UUID,
    data: LedgerEntryDelete,
    shop_id: UUID = Depends(get_shop_id),
    db: Session = Depends(get_db),
) -> LedgerEntry:
    service = DeleteLedgerEntryService(
        db=db,
        ledger_repository=LedgerEntryRepository(db),
        customer_repository=CustomerRepository(db),
        device_repository=DeviceRepository(db),
    )

    return service.execute(
        shop_id=shop_id,
        entry_id=entry_id,
        device_id=data.device_id,
        deleted_at=data.deleted_at,
    )