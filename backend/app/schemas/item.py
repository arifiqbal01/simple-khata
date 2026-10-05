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


class ItemCreate(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: ItemName


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shop_id: UUID
    name: str
    created_at: datetime