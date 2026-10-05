from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import LedgerEntryType


class EntryItemCreate(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    item_id: UUID | None = None
    name: str = Field(min_length=1, max_length=150)
    amount: int = Field(gt=0)


class EntryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    item_id: UUID | None
    name: str
    amount: int


class UdhaarCreate(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    customer_id: UUID
    device_id: UUID

    amount: int = Field(gt=0)

    note: str | None = Field(
        default=None,
        max_length=500,
    )

    occurred_at: datetime

    items: list[EntryItemCreate] = Field(
        default_factory=list,
    )


class PaymentCreate(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    customer_id: UUID
    device_id: UUID

    amount: int = Field(gt=0)

    note: str | None = Field(
        default=None,
        max_length=500,
    )

    occurred_at: datetime


class LedgerEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    device_id: UUID
    type: LedgerEntryType
    amount: int
    note: str | None
    occurred_at: datetime
    created_at: datetime
    items: list[EntryItemRead] = Field(default_factory=list)


class CustomerBalanceRead(BaseModel):
    customer_id: UUID
    balance: int