
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import PartyType
from app.models.party import Party


class PartyRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(
        self,
        *,
        party_id: UUID,
        shop_id: UUID,
        name: str,
        party_type: PartyType = PartyType.CUSTOMER,
        phone: str | None = None,
    ) -> Party:
        party = Party(
            id=party_id,
            shop_id=shop_id,
            type=party_type,
            name=name,
            phone=phone,
        )

        self.db.add(party)
        self.db.flush()
        self.db.refresh(party)

        return party

    def get_by_id(
        self,
        party_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Party | None:
        statement = select(Party).where(
            Party.id == party_id,
        )

        if not include_deleted:
            statement = statement.where(
                Party.deleted_at.is_(None),
            )

        return self.db.scalar(statement)

    def get_by_id_and_shop(
        self,
        *,
        party_id: UUID,
        shop_id: UUID,
        include_deleted: bool = False,
    ) -> Party | None:
        statement = select(Party).where(
            Party.id == party_id,
            Party.shop_id == shop_id,
        )

        if not include_deleted:
            statement = statement.where(
                Party.deleted_at.is_(None),
            )

        return self.db.scalar(statement)

    def get_by_phone(
        self,
        *,
        shop_id: UUID,
        phone: str,
        party_type: PartyType | None = None,
    ) -> Party | None:
        statement = select(Party).where(
            Party.shop_id == shop_id,
            Party.phone == phone,
            Party.deleted_at.is_(None),
        )

        if party_type is not None:
            statement = statement.where(
                Party.type == party_type,
            )

        return self.db.scalar(statement)

    def list_by_shop(
        self,
        *,
        shop_id: UUID,
        party_type: PartyType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Party]:
        statement = select(Party).where(
            Party.shop_id == shop_id,
            Party.deleted_at.is_(None),
        )

        if party_type is not None:
            statement = statement.where(
                Party.type == party_type,
            )

        statement = (
            statement
            .order_by(Party.name, Party.id)
            .limit(limit)
            .offset(offset)
        )

        return list(self.db.scalars(statement).all())

    def search(
        self,
        *,
        shop_id: UUID,
        query: str,
        party_type: PartyType | None = None,
        limit: int = 50,
    ) -> list[Party]:
        pattern = f"%{query}%"

        statement = select(Party).where(
            Party.shop_id == shop_id,
            Party.name.ilike(pattern),
            Party.deleted_at.is_(None),
        )

        if party_type is not None:
            statement = statement.where(
                Party.type == party_type,
            )

        statement = (
            statement
            .order_by(Party.name, Party.id)
            .limit(limit)
        )

        return list(self.db.scalars(statement).all())

    def update(
        self,
        party: Party,
        *,
        values: dict[str, object],
    ) -> Party:
        if party.deleted_at is not None:
            raise ValueError("Cannot update a deleted party")

        allowed_fields = {"name", "phone"}

        if not set(values).issubset(allowed_fields):
            raise ValueError("Invalid party update fields")

        for field, value in values.items():
            setattr(party, field, value)

        self.db.flush()

        return party

    def soft_delete(
        self,
        *,
        party: Party,
        deleted_at: datetime,
        deleted_by_device_id: UUID,
    ) -> Party:
        if party.deleted_at is not None:
            return party

        party.deleted_at = deleted_at
        party.deleted_by_device_id = deleted_by_device_id

        self.db.flush()

        return party