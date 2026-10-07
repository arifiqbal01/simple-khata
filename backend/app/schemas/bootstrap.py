from uuid import UUID

from pydantic import BaseModel, Field


class BootstrapCreate(BaseModel):
    shop_id: UUID | None = None
    device_id: UUID | None = None

    shop_name: str = Field(
        min_length=1,
        max_length=150,
    )

    device_name: str | None = Field(
        default=None,
        max_length=150,
    )


class BootstrapJoin(BaseModel):
    shop_id: UUID
    device_id: UUID

    device_name: str | None = Field(
        default=None,
        max_length=150,
    )


class BootstrapRead(BaseModel):
    shop_id: UUID
    device_id: UUID