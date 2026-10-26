
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncChange } from '@/api/syncApi';

interface PartyData {
  id: string;
  shopId: string;
  type?: 'CUSTOMER' | 'SUPPLIER';
  name: string;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ItemData {
  id: string;
  shopId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  defaultUnit?: string | null;
  defaultSellingPrice?: number | null;
}

interface DeleteData {
  shopId?: string;
  deletedAt: string;
  deletedByDeviceId: string;
}

export async function applyEntityChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const operationType: string = change.operationType;

  switch (operationType) {
    case 'CUSTOMER_CREATE':
    case 'CUSTOMER_UPDATE':
    case 'PARTY_CREATE':
    case 'PARTY_UPDATE':
      await applyPartyUpsert(db, shopId, change);
      return;

    case 'PARTY_DELETE':
      await applyPartyDelete(db, shopId, change);
      return;

    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
      await applyItemUpsert(db, shopId, change);
      return;

    case 'ITEM_DELETE':
      await applyItemDelete(db, shopId, change);
      return;

    default:
      throw new Error(
        `Unsupported entity operation: ${operationType}`
      );
  }
}

async function applyPartyUpsert(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload = change.payload as {
    party?: PartyData;
    customer?: PartyData;
  };

  const party = payload.party ?? payload.customer;

  if (!party || change.entityId !== party.id) {
    throw new Error('Remote party ID mismatch');
  }

  if (party.shopId !== shopId) {
    throw new Error('Remote party belongs to another shop');
  }

  const type =
    change.operationType === 'CUSTOMER_CREATE' ||
    change.operationType === 'CUSTOMER_UPDATE'
      ? 'CUSTOMER'
      : party.type;

  if (type !== 'CUSTOMER' && type !== 'SUPPLIER') {
    throw new Error('Invalid remote party type');
  }

  /*
   * Existing tombstones remain deleted.
   * A replayed create/update must not resurrect them.
   */
  await db.runAsync(
    `
      INSERT INTO parties (
        id,
        shop_id,
        type,
        name,
        phone,
        created_at,
        updated_at,
        deleted_at,
        deleted_by_device_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)

      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        updated_at = excluded.updated_at

      WHERE parties.shop_id = excluded.shop_id
        AND parties.type = excluded.type
        AND parties.deleted_at IS NULL
        AND excluded.updated_at >= parties.updated_at
    `,
    party.id,
    shopId,
    type,
    party.name,
    party.phone ?? null,
    party.createdAt,
    party.updatedAt
  );
}

async function applyPartyDelete(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload = change.payload as {
    partyId?: string;
    shopId?: string;
    deletedAt?: string;
    deletedByDeviceId?: string;
  };

  if (
    !payload.partyId ||
    payload.partyId !== change.entityId ||
    !payload.deletedAt ||
    !payload.deletedByDeviceId
  ) {
    throw new Error('Invalid remote party deletion');
  }

  if (payload.shopId && payload.shopId !== shopId) {
    throw new Error('Remote party belongs to another shop');
  }

  const existing = await db.getFirstAsync<{ id: string }>(
    `
      SELECT id
      FROM parties
      WHERE id = ?
        AND shop_id = ?
      LIMIT 1
    `,
    payload.partyId,
    shopId
  );

  if (!existing) {
    throw new Error(
      `Remote party not found for deletion: ${payload.partyId}`
    );
  }

  await ensureRemoteDevice(
    db,
    shopId,
    payload.deletedByDeviceId,
    payload.deletedAt
  );

  await db.runAsync(
    `
      UPDATE parties
      SET
        deleted_at = ?,
        deleted_by_device_id = ?,
        updated_at = ?
      WHERE id = ?
        AND shop_id = ?
        AND deleted_at IS NULL
    `,
    payload.deletedAt,
    payload.deletedByDeviceId,
    payload.deletedAt,
    payload.partyId,
    shopId
  );
}

async function applyItemUpsert(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload = change.payload as {
    item?: ItemData;
  };

  const item = payload.item;

  if (!item || change.entityId !== item.id) {
    throw new Error('Remote item ID mismatch');
  }

  if (item.shopId !== shopId) {
    throw new Error('Remote item belongs to another shop');
  }

  await db.runAsync(
    `
      INSERT INTO items (
        id,
        shop_id,
        name,
        created_at,
        default_unit,
        default_selling_price,
        deleted_at,
        deleted_by_device_id
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)

      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        default_unit = excluded.default_unit,
        default_selling_price =
          excluded.default_selling_price

      WHERE items.shop_id = excluded.shop_id
        AND items.deleted_at IS NULL
    `,
    item.id,
    shopId,
    item.name,
    item.createdAt,
    item.defaultUnit ?? null,
    item.defaultSellingPrice ?? null
  );
}


async function applyItemDelete(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload = change.payload as {
    item?: {
      id?: string;
      shopId?: string;
      deletedAt?: string;
      deletedByDeviceId?: string;
    };
    itemId?: string;
    shopId?: string;
    deletedAt?: string;
    deletedByDeviceId?: string;
  };

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid remote item deletion payload');
  }

  const itemId = payload.item?.id ?? payload.itemId;
  const remoteShopId =
    payload.item?.shopId ?? payload.shopId;
  const deletedAt =
    payload.item?.deletedAt ?? payload.deletedAt;
  const deletedByDeviceId =
    payload.item?.deletedByDeviceId ??
    payload.deletedByDeviceId;

  if (
    !itemId ||
    itemId !== change.entityId ||
    !deletedAt ||
    !Number.isFinite(Date.parse(deletedAt)) ||
    !deletedByDeviceId
  ) {
    throw new Error(
      `Invalid remote item deletion: ${change.entityId}`
    );
  }

  if (remoteShopId && remoteShopId !== shopId) {
    throw new Error('Remote item belongs to another shop');
  }

  const existing = await db.getFirstAsync<{
    id: string;
  }>(
    `
      SELECT id
      FROM items
      WHERE id = ?
        AND shop_id = ?
      LIMIT 1
    `,
    itemId,
    shopId
  );

  if (!existing) {
    throw new Error(
      `Remote item not found for deletion: ${itemId}`
    );
  }

  await ensureRemoteDevice(
    db,
    shopId,
    deletedByDeviceId,
    deletedAt
  );

  await db.runAsync(
    `
      UPDATE items
      SET
        deleted_at = ?,
        deleted_by_device_id = ?
      WHERE id = ?
        AND shop_id = ?
        AND deleted_at IS NULL
    `,
    deletedAt,
    deletedByDeviceId,
    itemId,
    shopId
  );
}


async function ensureRemoteDevice(
  db: SQLiteDatabase,
  shopId: string,
  deviceId: string,
  createdAt: string
): Promise<void> {
  const existing = await db.getFirstAsync<{
    shop_id: string;
  }>(
    'SELECT shop_id FROM devices WHERE id = ?',
    deviceId
  );

  if (existing) {
    if (existing.shop_id !== shopId) {
      throw new Error('Remote device belongs to another shop');
    }

    return;
  }

  await db.runAsync(
    `
      INSERT INTO devices (
        id,
        shop_id,
        name,
        last_sync_at,
        created_at
      )
      VALUES (?, ?, ?, NULL, ?)
    `,
    deviceId,
    shopId,
    'Remote device',
    createdAt
  );
}
