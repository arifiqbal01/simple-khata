
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import SyncConflictException
from app.repositories.party_repository import PartyRepository
from app.schemas.sync import (
    PartyCreateOperation,
    PartyUpdateOperation,
    PartyDeleteOperation,
)
from app.services.party.utils import normalize_phone


def _validate_party_operation(
    *,
    shop_id: UUID,
    operation: PartyCreateOperation | PartyUpdateOperation,
) -> None:
    data = operation.payload.party

    if operation.entityId != data.id:
        raise SyncConflictException(
            "Operation entity ID does not match party ID"
        )

    if data.shopId != shop_id:
        raise SyncConflictException(
            "Party belongs to another shop"
        )


def apply_party_create(
    db: Session,
    *,
    shop_id: UUID,
    operation: PartyCreateOperation,
) -> None:
    _validate_party_operation(
        shop_id=shop_id,
        operation=operation,
    )

    repository = PartyRepository(db)
    data = operation.payload.party

    existing = repository.get_by_id(
        data.id,
        include_deleted=True,
    )

    if existing is not None:
        raise SyncConflictException(
            f"Party {data.id} already exists"
        )

    phone = normalize_phone(data.phone)

    if phone is not None:
        existing_by_phone = repository.get_by_phone(
            shop_id=shop_id,
            phone=phone,
        )

        if existing_by_phone is not None:
            raise SyncConflictException(
                "A party with this phone number already exists"
            )

    name = data.name.strip()

    if not name:
        raise SyncConflictException(
            "Party name cannot be empty"
        )

    repository.create(
        party_id=data.id,
        shop_id=shop_id,
        party_type=data.type,
        name=name,
        phone=phone,
    )


def apply_party_update(
    db: Session,
    *,
    shop_id: UUID,
    operation: PartyUpdateOperation,
) -> None:
    _validate_party_operation(
        shop_id=shop_id,
        operation=operation,
    )

    repository = PartyRepository(db)
    data = operation.payload.party

    party = repository.get_by_id_and_shop(
        party_id=data.id,
        shop_id=shop_id,
    )

    if party is None:
        raise SyncConflictException(
            f"Party {data.id} does not exist or is deleted"
        )

    if party.type != data.type:
        raise SyncConflictException(
            "Party type cannot be changed"
        )

    name = data.name.strip()

    if not name:
        raise SyncConflictException(
            "Party name cannot be empty"
        )

    phone = normalize_phone(data.phone)

    if phone is not None:
        existing_by_phone = repository.get_by_phone(
            shop_id=shop_id,
            phone=phone,
        )

        if (
            existing_by_phone is not None
            and existing_by_phone.id != party.id
        ):
            raise SyncConflictException(
                "A party with this phone number already exists"
            )

    repository.update(
        party,
        values={
            "name": name,
            "phone": phone,
        },
    )





def apply_party_delete(
    db: Session,
    *,
    shop_id: UUID,
    device_id: UUID,
    operation: PartyDeleteOperation,
) -> None:
    repository = PartyRepository(db)
    data = operation.payload

    entity_id = UUID(str(operation.entityId))
    party_id = UUID(str(data.partyId))
    payload_shop_id = UUID(str(data.shopId))
    deleting_device_id = UUID(str(data.deletedByDeviceId))

    if entity_id != party_id:
        raise SyncConflictException(
            "Operation entity ID does not match party ID"
        )

    if payload_shop_id != shop_id:
        raise SyncConflictException(
            "Deleting shop ID mismatch"
        )

    if deleting_device_id != device_id:
        raise SyncConflictException(
            "Deleting device ID mismatch"
        )

    party = repository.get_by_id_and_shop(
        party_id=party_id,
        shop_id=shop_id,
        include_deleted=True,
    )

    if party is None:
        raise SyncConflictException(
            f"Party {party_id} does not exist"
        )

    # Preserve idempotency.
    if party.deleted_at is not None:
        return

    repository.soft_delete(
        party=party,
        deleted_at=data.deletedAt,
        deleted_by_device_id=device_id,
    )


