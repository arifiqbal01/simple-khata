
from datetime import datetime
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
)


ItemName = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=150,
    ),
]

ItemUnit = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=30,
    ),
]

ItemPrice = Annotated[
    int,
    Field(
        ge=0,
        le=9223372036854775807,
        strict=True,
    ),
]


class ItemCreate(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: ItemName
    default_unit: ItemUnit | None = None
    default_selling_price: ItemPrice | None = None


class ItemUpdate(BaseModel):
    name: ItemName | None = None
    default_unit: ItemUnit | None = None
    default_selling_price: ItemPrice | None = None


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shop_id: UUID
    name: str
    default_unit: str | None
    default_selling_price: int | None
    created_at: datetime
    deleted_at: datetime | None = None
    deleted_by_device_id: UUID | None = None


class ItemBulkDelete(BaseModel):
    item_ids: list[UUID] = Field(
        min_length=1,
        max_length=500,
    )


class ItemBulkDeleteResult(BaseModel):
    deleted_count: int
    already_deleted_count: int