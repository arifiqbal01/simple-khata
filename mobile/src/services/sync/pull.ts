// src/sync/pull.ts

import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import { syncStateRepository } from '@/repositories/sync-state';

import {
  pullSync,
  type SyncChange,
} from '@/api/syncApi';

const PULL_BATCH_SIZE = 100;

interface CustomerSyncPayload {
  customer: {
    id: string;
    shopId: string;
    name: string;
    phone: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

interface ItemSyncPayload {
  item: {
    id: string;
    shopId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface LedgerEntrySyncPayload {
  entry: {
    id: string;
    customerId: string;
    deviceId: string;
    type: 'UDHAAR' | 'PAYMENT';
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
    amount: number | null;
    createdAt: string;
  }>;
}

export interface PullRemoteChangesInput {
  shopId: string;
  deviceId: string;
}

export interface PullRemoteChangesResult {
  pulled: number;
  cursor: number;
}

export async function pullRemoteChanges({
  shopId,
  deviceId,
}: PullRemoteChangesInput): Promise<PullRemoteChangesResult> {
  const db = await getDatabase();

  let cursor =
    await syncStateRepository.getPullCursor(
      shopId
    );

  let totalPulled = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await pullSync({
      shopId,
      deviceId,
      cursor,
      limit: PULL_BATCH_SIZE,
    });

    await db.withTransactionAsync(async () => {
      for (const change of response.changes) {
        await applyRemoteChange(
          db,
          shopId,
          change
        );
      }

      /*
       * Cursor advancement is part of the same SQLite
       * transaction as applying the remote changes.
       */
      await syncStateRepository.setPullCursorWithDatabase(
        db,
        shopId,
        response.nextCursor
      );
    });

    totalPulled += response.changes.length;

    cursor = response.nextCursor;
    hasMore = response.hasMore;
  }

  return {
    pulled: totalPulled,
    cursor,
  };
}

async function applyRemoteChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  switch (change.operationType) {
    case 'CUSTOMER_CREATE':
    case 'CUSTOMER_UPDATE':
      await applyCustomerChange(
        db,
        shopId,
        change
      );
      return;

    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
      await applyItemChange(
        db,
        shopId,
        change
      );
      return;

    case 'LEDGER_ENTRY_CREATE':
      await applyLedgerEntryChange(
        db,
        shopId,
        change
      );
      return;

    default:
      throw new Error(
        `Unsupported sync operation: ${change.operationType}`
      );
  }
}

async function applyCustomerChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload =
    change.payload as CustomerSyncPayload;

  const customer = payload.customer;

  if (change.entityId !== customer.id) {
    throw new Error(
      'Remote customer entity ID mismatch'
    );
  }

  if (customer.shopId !== shopId) {
    throw new Error(
      'Remote customer belongs to another shop'
    );
  }

  /*
   * Apply directly to SQLite.
   *
   * Do not call the normal customer domain service here,
   * because a pulled change must not create another
   * sync_outbox operation.
   */
  await db.runAsync(
    `
      INSERT INTO customers (
        id,
        shop_id,
        name,
        phone,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)

      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        updated_at = excluded.updated_at
    `,
    customer.id,
    customer.shopId,
    customer.name,
    customer.phone,
    customer.createdAt,
    customer.updatedAt
  );
}

async function applyItemChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload =
    change.payload as ItemSyncPayload;

  const item = payload.item;

  if (change.entityId !== item.id) {
    throw new Error(
      'Remote item entity ID mismatch'
    );
  }

  if (item.shopId !== shopId) {
    throw new Error(
      'Remote item belongs to another shop'
    );
  }

  await db.runAsync(
    `
      INSERT INTO items (
        id,
        shop_id,
        name,
        created_at
      )
      VALUES (?, ?, ?, ?)

      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name
    `,
    item.id,
    item.shopId,
    item.name,
    item.createdAt
  );
}

async function applyLedgerEntryChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const payload =
    change.payload as LedgerEntrySyncPayload;

  const entry = payload.entry;

  if (change.entityId !== entry.id) {
    throw new Error(
      'Remote ledger entry entity ID mismatch'
    );
  }

  /*
   * A ledger entry can originate on another device.
   *
   * Device B may therefore receive an entry whose
   * device_id belongs to Device A.
   *
   * Keep the original device_id for provenance, but
   * ensure the referenced device exists locally so
   * the ledger_entries FK remains valid.
   */
  const existingDevice =
    await db.getFirstAsync<{ id: string }>(
      `
        SELECT id
        FROM devices
        WHERE id = ?
        LIMIT 1
      `,
      entry.deviceId
    );

  if (!existingDevice) {
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
      entry.deviceId,
      shopId,
      'Remote device',
      entry.createdAt
    );
  }

  /*
   * Ledger entries are immutable facts.
   *
   * Replaying a server change must not create
   * another financial entry.
   */
  await db.runAsync(
    `
      INSERT OR IGNORE INTO ledger_entries (
        id,
        customer_id,
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
    entry.customerId,
    entry.deviceId,
    entry.type,
    entry.amount,
    entry.note,
    entry.occurredAt,
    entry.createdAt
  );

  for (const item of payload.items) {
    if (item.ledgerEntryId !== entry.id) {
      throw new Error(
        'Remote entry item belongs to another ledger entry'
      );
    }

    /*
     * item_id is descriptive/reference data.
     *
     * If the catalog item is not present locally,
     * don't violate the FK. The snapshot item name
     * still preserves what was sold.
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

      localItemId =
        existingItem?.id ?? null;
    }

    await db.runAsync(
      `
        INSERT OR IGNORE INTO entry_items (
          id,
          ledger_entry_id,
          item_id,
          name,
          amount
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      item.id,
      entry.id,
      localItemId,
      item.itemName,
      item.amount
    );
  }
}