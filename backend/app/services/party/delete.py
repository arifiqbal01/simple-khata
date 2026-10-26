
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.party import Party
from app.repositories.party_repository import PartyRepository


class DeletePartyService:
    def __init__(
        self,
        db: Session,
        repository: PartyRepository,
    ) -> None:
        self.db = db
        self.repository = repository

    def execute(
        self,
        *,
        shop_id: UUID,
        party_id: UUID,
        device_id: UUID,
    ) -> Party:
        party = self.repository.get_by_id_and_shop(
            party_id=party_id,
            shop_id=shop_id,
            include_deleted=True,
        )

        if party is None:
            raise NotFoundException("Party not found")

        if party.deleted_at is not None:
            return party

        try:
            party = self.repository.soft_delete(
                party=party,
                deleted_at=datetime.now(timezone.utc),
                deleted_by_device_id=device_id,
            )

            self.db.commit()
            self.db.refresh(party)

            return party

        except Exception:
            self.db.rollback()
            raise