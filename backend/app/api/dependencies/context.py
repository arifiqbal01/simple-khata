from uuid import UUID

from fastapi import Header


def get_shop_id(
    x_shop_id: UUID = Header(alias="X-Shop-ID"),
) -> UUID:
    return x_shop_id