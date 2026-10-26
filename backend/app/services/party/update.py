
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.party import Party
from app.repositories.party_repository import PartyRepository
from app.schemas.party import PartyUpdate
from app.services.party.utils import normalize_phone


class UpdatePartyService:
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
        data: PartyUpdate,
    ) -> Party:
        party = self.repository.get_by_id_and_shop(
            party_id=party_id,
            shop_id=shop_id,
        )

        if party is None:
            raise NotFoundException("Party not found")

        values = data.model_dump(exclude_unset=True)

        if "name" in values:
            name = values["name"]

            if name is None or not name.strip():
                raise ValueError("Party name cannot be empty")

            values["name"] = name.strip()

        if "phone" in values:
            values["phone"] = normalize_phone(values["phone"])
            phone = values["phone"]

            if phone is not None:
                existing = self.repository.get_by_phone(
                    shop_id=shop_id,
                    phone=phone,
                )

                if (
                    existing is not None
                    and existing.id != party.id
                ):
                    raise ConflictException(
                        "A party with this phone number already exists"
                    )

        try:
            party = self.repository.update(
                party,
                values=values,
            )

            self.db.commit()
            self.db.refresh(party)

            return party

        except IntegrityError as exc:
            self.db.rollback()

            raise ConflictException(
                "Party could not be updated because it conflicts "
                "with an existing record"
            ) from exc