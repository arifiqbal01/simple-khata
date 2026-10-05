from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.item import Item


class ItemRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        item_id: UUID,
        shop_id: UUID,
        name: str,
    ) -> Item:
        item = Item(
            id=item_id,
            shop_id=shop_id,
            name=name,
        )

        self.db.add(item)
        self.db.flush()

        return item

    def get_by_id(
        self,
        item_id: UUID,
    ) -> Item | None:
        return self.db.get(Item, item_id)

    def get_by_id_and_shop(
        self,
        *,
        item_id: UUID,
        shop_id: UUID,
    ) -> Item | None:
        statement = select(Item).where(
            Item.id == item_id,
            Item.shop_id == shop_id,
        )

        return self.db.scalar(statement)

    def list_by_shop(
        self,
        *,
        shop_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Item]:
        statement = (
            select(Item)
            .where(Item.shop_id == shop_id)
            .order_by(Item.name, Item.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def search(
        self,
        *,
        shop_id: UUID,
        query: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Item]:
        pattern = f"%{query}%"

        statement = (
            select(Item)
            .where(
                Item.shop_id == shop_id,
                Item.name.ilike(pattern),
            )
            .order_by(Item.name, Item.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())