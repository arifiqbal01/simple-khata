
from datetime import datetime, timezone
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
        default_unit: str | None = None,
        default_selling_price: int | None = None,
    ) -> Item:
        item = Item(
            id=item_id,
            shop_id=shop_id,
            name=name,
            default_unit=default_unit,
            default_selling_price=default_selling_price,
        )

        self.db.add(item)
        self.db.flush()

        return item

    def get_by_id(
        self,
        item_id: UUID,
    ) -> Item | None:
        # Internal lookup, including soft-deleted item.
        return self.db.get(Item, item_id)

    def get_by_id_and_shop(
        self,
        *,
        item_id: UUID,
        shop_id: UUID,
        include_deleted: bool = False,
    ) -> Item | None:
        statement = select(Item).where(
            Item.id == item_id,
            Item.shop_id == shop_id,
        )

        if not include_deleted:
            statement = statement.where(
                Item.deleted_at.is_(None)
            )

        return self.db.scalar(statement)

    def list_by_shop(
        self,
        *,
        shop_id: UUID,
        limit: int = 100,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> list[Item]:
        statement = select(Item).where(
            Item.shop_id == shop_id
        )

        if not include_deleted:
            statement = statement.where(
                Item.deleted_at.is_(None)
            )

        statement = (
            statement
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
        include_deleted: bool = False,
    ) -> list[Item]:
        escaped_query = (
            query.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{escaped_query}%"

        statement = select(Item).where(
            Item.shop_id == shop_id,
            Item.name.ilike(pattern, escape="\\"),
        )

        if not include_deleted:
            statement = statement.where(
                Item.deleted_at.is_(None)
            )

        statement = (
            statement
            .order_by(Item.name, Item.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def update(
        self,
        item: Item,
        *,
        values: dict,
    ) -> Item:
        if item.deleted_at is not None:
            raise ValueError(
                "Cannot update a deleted item"
            )

        allowed_fields = {
            "name",
            "default_unit",
            "default_selling_price",
        }

        for field, value in values.items():
            if field not in allowed_fields:
                raise ValueError(
                    f"Item field cannot be updated: {field}"
                )

            setattr(item, field, value)

        self.db.flush()

        return item

    def soft_delete(
        self,
        *,
        item: Item,
        device_id: UUID,
        deleted_at: datetime | None = None,
    ) -> Item:
        if item.deleted_at is not None:
            return item

        if deleted_at is None:
            deleted_at = datetime.now(timezone.utc)

        if (
            deleted_at.tzinfo is None
            or deleted_at.utcoffset() is None
        ):
            raise ValueError(
                "deleted_at must be timezone-aware"
            )

        item.deleted_at = deleted_at
        item.deleted_by_device_id = device_id

        self.db.flush()

        return item

    def bulk_soft_delete(
        self,
        *,
        shop_id: UUID,
        item_ids: list[UUID],
        device_id: UUID,
        deleted_at: datetime | None = None,
    ) -> list[Item]:
        if not item_ids:
            return []

        unique_ids = list(dict.fromkeys(item_ids))

        if deleted_at is None:
            deleted_at = datetime.now(timezone.utc)

        if (
            deleted_at.tzinfo is None
            or deleted_at.utcoffset() is None
        ):
            raise ValueError(
                "deleted_at must be timezone-aware"
            )

        statement = (
            select(Item)
            .where(
                Item.shop_id == shop_id,
                Item.id.in_(unique_ids),
            )
            .with_for_update()
        )

        items = list(self.db.scalars(statement).all())

        if len(items) != len(unique_ids):
            raise ValueError(
                "One or more item were not found "
                "in this shop"
            )

        deleted_items = []

        for item in items:
            if item.deleted_at is not None:
                continue

            item.deleted_at = deleted_at
            item.deleted_by_device_id = device_id
            deleted_items.append(item)

        self.db.flush()

        return deleted_items