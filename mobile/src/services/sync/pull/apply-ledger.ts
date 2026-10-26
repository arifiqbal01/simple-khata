
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncChange } from '@/api/syncApi';

interface LedgerEntryPayload {
  entry: {
    id: string;
    partyId?: string;
    customerId?: string;
    deviceId: string;
    type: 'UDHAAR' | 'SUPPLY' | 'PAYMENT';
    amount: number;
    note: string | null;
    occurredAt: string;
    createdAt: string;
  };

  items: Array<{
    id: string;
    ledgerEntryId: string;
    itemId: string | null;
    itemName: string;
    amount?: number | null;
    quantity?: string | null;
    unit?: string | null;
    unitPrice?: number | null;
    createdAt: string;
  }>;
}

interface LedgerDeletePayload {
  entry: {
    id: string;
    deletedAt: string;
    deletedByDeviceId: string;
  };
}

export async function applyLedgerChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  switch (change.operationType) {
    case 'LEDGER_ENTRY_CREATE':
      await applyLedgerCreate(db, shopId, change);
      return;

    case 'LEDGER_ENTRY_DELETE':
      await applyLedgerDelete(db, shopId, change);
      return;

    default:
      throw new Error(
        `Unsupported ledger operation: ${change.operationType}`
      );
  }
}

async function applyLedgerCreate(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload = change.payload as LedgerEntryPayload;
  const entry = payload.entry;

  if (!entry || change.entityId !== entry.id) {
    throw new Error('Remote ledger entry ID mismatch');
  }

  const partyId = entry.partyId ?? entry.customerId;

  if (!partyId) {
    throw new Error('Remote ledger entry has no Party ID');
  }

  const party = await db.getFirstAsync<{
    id: string;
    type: 'CUSTOMER' | 'SUPPLIER';
  }>(
    `
      SELECT id, type
      FROM parties
      WHERE id = ?
        AND shop_id = ?
      LIMIT 1
    `,
    partyId,
    shopId
  );

  if (!party) {
    throw new Error(
      `Remote ledger Party not found: ${partyId}`
    );
  }

  if (
    (entry.type === 'UDHAAR' &&
      party.type !== 'CUSTOMER') ||
    (entry.type === 'SUPPLY' &&
      party.type !== 'SUPPLIER') ||
    !['UDHAAR', 'SUPPLY', 'PAYMENT'].includes(entry.type)
  ) {
    throw new Error('Invalid ledger type for Party');
  }

  if (
    !Number.isSafeInteger(entry.amount) ||
    entry.amount <= 0
  ) {
    throw new Error('Invalid remote ledger amount');
  }

  await ensureRemoteDevice(
    db,
    shopId,
    entry.deviceId,
    entry.createdAt
  );

  /*
   * Ledger entries are immutable.
   * Replaying a create does not duplicate it.
   */
  await db.runAsync(
    `
      INSERT OR IGNORE INTO ledger_entries (
        id,
        party_id,
        device_id,
        type,
        amount,
        note,
        occurred_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    entry.id,
    partyId,
    entry.deviceId,
    entry.type,
    entry.amount,
    entry.note,
    entry.occurredAt,
    entry.createdAt
  );

  for (const item of payload.items ?? []) {
    if (item.ledgerEntryId !== entry.id) {
      throw new Error(
        'Remote item belongs to another ledger entry'
      );
    }

    /*
     * Preserve the item snapshot even if its
     * catalog item is missing locally.
     */
    let localItemId: string | null = null;

    if (item.itemId) {
      const existingItem =
        await db.getFirstAsync<{ id: string }>(
          `
            SELECT id
            FROM items
            WHERE id = ?
              AND shop_id = ?
            LIMIT 1
          `,
          item.itemId,
          shopId
        );

      localItemId = existingItem?.id ?? null;
    }

    await db.runAsync(
      `
        INSERT OR IGNORE INTO entry_items (
          id,
          ledger_entry_id,
          item_id,
          name,
          amount,
          quantity,
          unit,
          unit_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      item.id,
      entry.id,
      localItemId,
      item.itemName,
      item.amount ?? null,
      item.quantity ?? null,
      item.unit ?? null,
      item.unitPrice ?? null
    );
  }
}

async function applyLedgerDelete(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload = change.payload as LedgerDeletePayload;
  const entry = payload.entry;

  if (
    !entry?.id ||
    !entry.deletedAt ||
    !entry.deletedByDeviceId ||
    change.entityId !== entry.id
  ) {
    throw new Error('Invalid remote ledger deletion');
  }

  const existingEntry = await db.getFirstAsync<{
    id: string;
    deleted_at: string | null;
  }>(
    `
      SELECT le.id, le.deleted_at
      FROM ledger_entries AS le
      INNER JOIN parties AS p
        ON p.id = le.party_id
      WHERE le.id = ?
        AND p.shop_id = ?
      LIMIT 1
    `,
    entry.id,
    shopId
  );

  if (!existingEntry) {
    throw new Error(
      `Remote ledger entry not found: ${entry.id}`
    );
  }

  if (existingEntry.deleted_at !== null) {
    return;
  }

  await ensureRemoteDevice(
    db,
    shopId,
    entry.deletedByDeviceId,
    entry.deletedAt
  );

  await db.runAsync(
    `
      UPDATE ledger_entries
      SET
        deleted_at = ?,
        deleted_by_device_id = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    entry.deletedAt,
    entry.deletedByDeviceId,
    entry.id
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
