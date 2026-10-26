
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException
from app.models.party import Party
from app.repositories.party_repository import PartyRepository
from app.schemas.party import PartyCreate
from app.services.party.utils import normalize_phone


class CreatePartyService:
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
        data: PartyCreate,
    ) -> Party:
        phone = normalize_phone(data.phone)

        if phone is not None:
            existing = self.repository.get_by_phone(
                shop_id=shop_id,
                phone=phone,
            )

            if existing is not None:
                raise ConflictException(
                    "A party with this phone number already exists"
                )

        try:
            party = self.repository.create(
                party_id=data.id,
                shop_id=shop_id,
                party_type=data.type,
                name=data.name.strip(),
                phone=phone,
            )

            self.db.commit()
            self.db.refresh(party)

            return party

        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictException(
                "Party could not be created because it conflicts "
                "with an existing record"
            ) from exc
