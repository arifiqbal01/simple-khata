from uuid import UUID

from sqlalchemy.orm import Session

from app.models.shop import Shop


class ShopRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        shop_id: UUID,
        name: str,
    ) -> Shop:
        shop = Shop(
            id=shop_id,
            name=name,
        )

        self.db.add(shop)
        self.db.flush()

        return shop

    def get_by_id(
        self,
        shop_id: UUID,
    ) -> Shop | None:
        return self.db.get(Shop, shop_id)