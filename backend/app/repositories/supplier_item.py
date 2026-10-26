
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.item import Item
from app.models.party import Party
from app.models.enums import PartyType
from app.models.supplier_item import SupplierItem


class SupplierItemRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        supplier_item_id: UUID,
        shop_id: UUID,
        supplier_id: UUID,
        item_id: UUID,
        unit: str,
        unit_price: int,
    ) -> SupplierItem:
        supplier_item = SupplierItem(
            id=supplier_item_id,
            shop_id=shop_id,
            supplier_id=supplier_id,
            item_id=item_id,
            unit=unit,
            unit_price=unit_price,
        )

        self.db.add(supplier_item)
        self.db.flush()

        return supplier_item

    def get_by_id(
        self,
        supplier_item_id: UUID,
    ) -> SupplierItem | None:
        # Internal lookup. Use get_by_id_and_shop for APIs.
        return self.db.get(SupplierItem, supplier_item_id)

    def get_by_id_and_shop(
        self,
        *,
        supplier_item_id: UUID,
        shop_id: UUID,
    ) -> SupplierItem | None:
        statement = select(SupplierItem).where(
            SupplierItem.id == supplier_item_id,
            SupplierItem.shop_id == shop_id,
        )

        return self.db.scalar(statement)

    def get_by_supplier_and_item(
        self,
        *,
        shop_id: UUID,
        supplier_id: UUID,
        item_id: UUID,
    ) -> SupplierItem | None:
        statement = select(SupplierItem).where(
            SupplierItem.shop_id == shop_id,
            SupplierItem.supplier_id == supplier_id,
            SupplierItem.item_id == item_id,
        )

        return self.db.scalar(statement)

    def list_by_supplier(
        self,
        *,
        shop_id: UUID,
        supplier_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[SupplierItem]:
        statement = (
            select(SupplierItem)
            .join(Item, SupplierItem.item_id == Item.id)
            .where(
                SupplierItem.shop_id == shop_id,
                SupplierItem.supplier_id == supplier_id,
                Item.deleted_at.is_(None),
            )
            .order_by(Item.name, SupplierItem.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def list_by_item(
        self,
        *,
        shop_id: UUID,
        item_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[SupplierItem]:
        statement = (
            select(SupplierItem)
            .join(Party, SupplierItem.supplier_id == Party.id)
            .where(
                SupplierItem.shop_id == shop_id,
                SupplierItem.item_id == item_id,
                Party.type == PartyType.SUPPLIER,
                Party.deleted_at.is_(None),
            )
            .order_by(Party.name, SupplierItem.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def search(
        self,
        *,
        shop_id: UUID,
        supplier_id: UUID,
        query: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SupplierItem]:
        escaped_query = (
            query.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )

        pattern = f"%{escaped_query}%"

        statement = (
            select(SupplierItem)
            .join(Item, SupplierItem.item_id == Item.id)
            .where(
                SupplierItem.shop_id == shop_id,
                SupplierItem.supplier_id == supplier_id,
                Item.deleted_at.is_(None),
                Item.name.ilike(pattern, escape="\\"),
            )
            .order_by(Item.name, SupplierItem.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def update(
        self,
        supplier_item: SupplierItem,
        *,
        values: dict,
    ) -> SupplierItem:
        allowed_fields = {
            "unit",
            "unit_price",
        }

        for field, value in values.items():
            if field not in allowed_fields:
                raise ValueError(
                    f"Supplier item field cannot be updated: {field}"
                )

            if field == "unit":
                if (
                    not isinstance(value, str)
                    or not value.strip()
                    or len(value) > 30
                ):
                    raise ValueError(
                        "unit must contain 1 to 30 characters"
                    )
                value = value.strip()

            if field == "unit_price":
                if (
                    type(value) is not int
                    or value < 0
                    or value > 9223372036854775807
                ):
                    raise ValueError(
                        "unit_price must be a nonnegative integer"
                    )

            setattr(supplier_item, field, value)

        self.db.flush()

        return supplier_item

    def delete(
        self,
        *,
        supplier_item: SupplierItem,
    ) -> None:
        # Removes only the supplier-product association.
        # Does not delete the Item, Party, or historical EntryItem.
        self.db.delete(supplier_item)
        self.db.flush()