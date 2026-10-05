from datetime import datetime
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class CustomerCreate(BaseModel):
    id: UUID = Field(default_factory=uuid4)

    name: str = Field(
        min_length=1,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )


class CustomerUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shop_id: UUID
    name: str
    phone: str | None
    created_at: datetime
    updated_at: datetime