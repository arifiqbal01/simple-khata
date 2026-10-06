from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SyncEntityType(StrEnum):
    CUSTOMER = "CUSTOMER"
    ITEM = "ITEM"
    LEDGER_ENTRY = "LEDGER_ENTRY"


class SyncOperationType(StrEnum):
    CUSTOMER_CREATE = "CUSTOMER_CREATE"
    CUSTOMER_UPDATE = "CUSTOMER_UPDATE"
    ITEM_CREATE = "ITEM_CREATE"
    ITEM_UPDATE = "ITEM_UPDATE"
    LEDGER_ENTRY_CREATE = "LEDGER_ENTRY_CREATE"


class LedgerEntryType(StrEnum):
    UDHAAR = "UDHAAR"
    PAYMENT = "PAYMENT"


# ---------------------------------------------------------------------------
# Entity payloads
# ---------------------------------------------------------------------------


class CustomerSyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    name: str
    phone: str | None = None
    createdAt: datetime
    updatedAt: datetime


class ItemSyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    name: str
    createdAt: datetime
    updatedAt: datetime


class LedgerEntrySyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    customerId: UUID
    deviceId: UUID
    type: LedgerEntryType
    amount: int = Field(gt=0)
    note: str | None = None
    occurredAt: datetime
    createdAt: datetime


class EntryItemSyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    ledgerEntryId: UUID
    itemId: UUID | None = None
    itemName: str
    amount: int | None = Field(default=None, ge=0)
    createdAt: datetime


# ---------------------------------------------------------------------------
# Operation payloads
# ---------------------------------------------------------------------------


class CustomerPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer: CustomerSyncData


class ItemPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item: ItemSyncData


class LedgerEntryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry: LedgerEntrySyncData
    items: list[EntryItemSyncData] = Field(
        default_factory=list
    )


# ---------------------------------------------------------------------------
# Push operations
# ---------------------------------------------------------------------------


class CustomerCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.CUSTOMER_CREATE
    ]
    entityType: Literal[
        SyncEntityType.CUSTOMER
    ]
    entityId: UUID
    createdAt: datetime
    payload: CustomerPayload


class CustomerUpdateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.CUSTOMER_UPDATE
    ]
    entityType: Literal[
        SyncEntityType.CUSTOMER
    ]
    entityId: UUID
    createdAt: datetime
    payload: CustomerPayload


class ItemCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.ITEM_CREATE
    ]
    entityType: Literal[
        SyncEntityType.ITEM
    ]
    entityId: UUID
    createdAt: datetime
    payload: ItemPayload


class ItemUpdateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.ITEM_UPDATE
    ]
    entityType: Literal[
        SyncEntityType.ITEM
    ]
    entityId: UUID
    createdAt: datetime
    payload: ItemPayload


class LedgerEntryCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.LEDGER_ENTRY_CREATE
    ]
    entityType: Literal[
        SyncEntityType.LEDGER_ENTRY
    ]
    entityId: UUID
    createdAt: datetime
    payload: LedgerEntryPayload


SyncPushOperation = Annotated[
    CustomerCreateOperation
    | CustomerUpdateOperation
    | ItemCreateOperation
    | ItemUpdateOperation
    | LedgerEntryCreateOperation,
    Field(discriminator="operationType"),
]


# ---------------------------------------------------------------------------
# Push request / response
# ---------------------------------------------------------------------------


class SyncPushRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shopId: UUID
    deviceId: UUID
    operations: list[SyncPushOperation] = Field(
        default_factory=list,
        max_length=100,
    )


class SyncPushResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    acknowledgedOperationIds: list[UUID] = Field(
        default_factory=list
    )


# ---------------------------------------------------------------------------
# Pull
# ---------------------------------------------------------------------------


class SyncChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sequence: int = Field(gt=0)
    entityType: SyncEntityType
    entityId: UUID
    operationType: SyncOperationType
    payload: (
        CustomerPayload
        | ItemPayload
        | LedgerEntryPayload
    )
    createdAt: datetime


class SyncPullResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changes: list[SyncChange] = Field(
        default_factory=list
    )
    nextCursor: int = Field(ge=0)
    hasMore: bool = False