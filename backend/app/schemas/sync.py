
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.enums import LedgerEntryType, PartyType


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SyncEntityType(StrEnum):
    PARTY = "PARTY"
    CUSTOMER = "CUSTOMER"  # Legacy compatibility
    ITEM = "ITEM"
    LEDGER_ENTRY = "LEDGER_ENTRY"
    SUPPLIER_ITEM = "SUPPLIER_ITEM"


class SyncOperationType(StrEnum):
    PARTY_CREATE = "PARTY_CREATE"
    PARTY_UPDATE = "PARTY_UPDATE"
    PARTY_DELETE = "PARTY_DELETE"

    CUSTOMER_CREATE = "CUSTOMER_CREATE"  # Legacy
    CUSTOMER_UPDATE = "CUSTOMER_UPDATE"  # Legacy

    ITEM_CREATE = "ITEM_CREATE"
    ITEM_UPDATE = "ITEM_UPDATE"
    ITEM_DELETE = "ITEM_DELETE"

    SUPPLIER_ITEM_CREATE = "SUPPLIER_ITEM_CREATE"
    SUPPLIER_ITEM_UPDATE = "SUPPLIER_ITEM_UPDATE"
    SUPPLIER_ITEM_DELETE = "SUPPLIER_ITEM_DELETE"

    LEDGER_ENTRY_CREATE = "LEDGER_ENTRY_CREATE"
    LEDGER_ENTRY_DELETE = "LEDGER_ENTRY_DELETE"


# ---------------------------------------------------------------------------
# Entity payloads
# ---------------------------------------------------------------------------


class PartySyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    type: PartyType
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    createdAt: datetime
    updatedAt: datetime


class CustomerSyncData(BaseModel):
    """Legacy party payload for existing offline clients."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    name: str
    phone: str | None = None
    createdAt: datetime
    updatedAt: datetime


class PartyDeleteData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    deletedAt: datetime
    deletedByDeviceId: UUID


class LedgerEntryDeleteData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    deletedAt: datetime
    deletedByDeviceId: UUID


class ItemSyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    name: str = Field(min_length=1, max_length=150)
    defaultUnit: str | None = Field(default=None, max_length=30)
    defaultSellingPrice: int | None = Field(default=None, ge=0)
    createdAt: datetime
    updatedAt: datetime


class ItemDeleteData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    deletedAt: datetime
    deletedByDeviceId: UUID

class SupplierItemSyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    supplierId: UUID
    itemId: UUID
    unit: str = Field(min_length=1, max_length=30)
    unitPrice: int = Field(ge=0, le=9223372036854775807)
    createdAt: datetime
    updatedAt: datetime


class SupplierItemDeleteData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    shopId: UUID
    supplierId: UUID
    itemId: UUID


class LedgerEntrySyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    partyId: UUID
    deviceId: UUID
    type: LedgerEntryType
    amount: int = Field(gt=0)
    note: str | None = None
    occurredAt: datetime
    createdAt: datetime


class LegacyLedgerEntrySyncData(BaseModel):
    """Legacy ledger entry using customerId instead of partyId."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    customerId: UUID
    deviceId: UUID
    type: Literal[
        LedgerEntryType.UDHAAR,
        LedgerEntryType.PAYMENT,
    ]
    amount: int = Field(gt=0)
    note: str | None = None
    occurredAt: datetime
    createdAt: datetime


class EntryItemSyncData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    ledgerEntryId: UUID
    itemId: UUID | None = None
    itemName: str = Field(min_length=1, max_length=150)

    amount: int | None = Field(default=None, gt=0)

    quantity: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=3,
    )

    unit: str | None = Field(
        default=None,
        min_length=1,
        max_length=30,
    )

    unitPrice: int | None = Field(
        default=None,
        ge=0,
    )

    createdAt: datetime


# ---------------------------------------------------------------------------
# Operation payloads
# ---------------------------------------------------------------------------


class PartyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    party: PartySyncData


class CustomerPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer: CustomerSyncData


class PartyDeletePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    partyId: str
    shopId: str
    deletedAt: datetime
    deletedByDeviceId: str


class ItemPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item: ItemSyncData


class ItemDeletePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item: ItemDeleteData

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_payload(cls, value):
        if not isinstance(value, dict):
            return value

        if "item" in value:
            return value

        if "itemId" not in value:
            return value

        return {
            "item": {
                "id": value["itemId"],
                "deletedAt": value.get("deletedAt"),
                "deletedByDeviceId": value.get(
                    "deletedByDeviceId"
                ),
            }
        }

class SupplierItemPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    supplierItem: SupplierItemSyncData


class SupplierItemDeletePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    supplierItem: SupplierItemDeleteData


class LedgerEntryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry: LedgerEntrySyncData
    items: list[EntryItemSyncData] = Field(
        default_factory=list,
    )


class LegacyLedgerEntryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry: LegacyLedgerEntrySyncData
    items: list[EntryItemSyncData] = Field(
        default_factory=list,
    )


class LedgerEntryDeletePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entry: LedgerEntryDeleteData


# ---------------------------------------------------------------------------
# Party operations
# ---------------------------------------------------------------------------


class PartyCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.PARTY_CREATE]
    entityType: Literal[SyncEntityType.PARTY]
    entityId: UUID
    createdAt: datetime
    payload: PartyPayload


class PartyUpdateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.PARTY_UPDATE]
    entityType: Literal[SyncEntityType.PARTY]
    entityId: UUID
    createdAt: datetime
    payload: PartyPayload


class PartyDeleteOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.PARTY_DELETE]
    entityType: Literal[SyncEntityType.PARTY]
    entityId: UUID
    createdAt: datetime
    payload: PartyDeletePayload


# ---------------------------------------------------------------------------
# Legacy party operations
# ---------------------------------------------------------------------------


class CustomerCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.CUSTOMER_CREATE]
    entityType: Literal[SyncEntityType.CUSTOMER]
    entityId: UUID
    createdAt: datetime
    payload: CustomerPayload


class CustomerUpdateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.CUSTOMER_UPDATE]
    entityType: Literal[SyncEntityType.CUSTOMER]
    entityId: UUID
    createdAt: datetime
    payload: CustomerPayload


# ---------------------------------------------------------------------------
# Item operations
# ---------------------------------------------------------------------------


class ItemCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.ITEM_CREATE]
    entityType: Literal[SyncEntityType.ITEM]
    entityId: UUID
    createdAt: datetime
    payload: ItemPayload


class ItemUpdateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.ITEM_UPDATE]
    entityType: Literal[SyncEntityType.ITEM]
    entityId: UUID
    createdAt: datetime
    payload: ItemPayload

class ItemDeleteOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[SyncOperationType.ITEM_DELETE]
    entityType: Literal[SyncEntityType.ITEM]
    entityId: UUID
    createdAt: datetime
    payload: ItemDeletePayload


# ---------------------------------------------------------------------------
# Supplier item operations
# ---------------------------------------------------------------------------


class SupplierItemCreateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.SUPPLIER_ITEM_CREATE
    ]
    entityType: Literal[
        SyncEntityType.SUPPLIER_ITEM
    ]
    entityId: UUID
    createdAt: datetime
    payload: SupplierItemPayload


class SupplierItemUpdateOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.SUPPLIER_ITEM_UPDATE
    ]
    entityType: Literal[
        SyncEntityType.SUPPLIER_ITEM
    ]
    entityId: UUID
    createdAt: datetime
    payload: SupplierItemPayload


class SupplierItemDeleteOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.SUPPLIER_ITEM_DELETE
    ]
    entityType: Literal[
        SyncEntityType.SUPPLIER_ITEM
    ]
    entityId: UUID
    createdAt: datetime
    payload: SupplierItemDeletePayload


# ---------------------------------------------------------------------------
# Ledger operations
# ---------------------------------------------------------------------------


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
    payload: LedgerEntryPayload | LegacyLedgerEntryPayload

    @model_validator(mode="after")
    def validate_legacy_entry(self):
        # Existing customerId payloads are only valid for
        # legacy party transaction types.
        if isinstance(self.payload, LegacyLedgerEntryPayload):
            if self.payload.entry.type not in (
                LedgerEntryType.UDHAAR,
                LedgerEntryType.PAYMENT,
            ):
                raise ValueError(
                    "Legacy ledger entries cannot use SUPPLY"
                )

        return self


class LedgerEntryDeleteOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    operationType: Literal[
        SyncOperationType.LEDGER_ENTRY_DELETE
    ]
    entityType: Literal[
        SyncEntityType.LEDGER_ENTRY
    ]
    entityId: UUID
    createdAt: datetime
    payload: LedgerEntryDeletePayload


# ---------------------------------------------------------------------------
# Push operation union
# ---------------------------------------------------------------------------


SyncPushOperation = Annotated[
    PartyCreateOperation
    | PartyUpdateOperation
    | PartyDeleteOperation
    | CustomerCreateOperation
    | CustomerUpdateOperation
    | ItemCreateOperation
    | ItemUpdateOperation
    | ItemDeleteOperation
    | SupplierItemCreateOperation
    | SupplierItemUpdateOperation
    | SupplierItemDeleteOperation
    | LedgerEntryCreateOperation
    | LedgerEntryDeleteOperation,
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
        default_factory=list,
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
        PartyPayload
        | PartyDeletePayload
        | CustomerPayload
        | ItemPayload
        | ItemDeletePayload
        | SupplierItemPayload
        | SupplierItemDeletePayload
        | LedgerEntryPayload
        | LegacyLedgerEntryPayload
        | LedgerEntryDeletePayload
    )

    createdAt: datetime


class SyncPullResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changes: list[SyncChange] = Field(
        default_factory=list,
    )
    nextCursor: int = Field(ge=0)
    hasMore: bool = False