import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import { LedgerRepository } from '@/repositories/ledger';
import { syncOutboxRepository } from '@/repositories/sync-outbox';

export interface DeleteLedgerEntryInput {
  shopId: string;
  deviceId: string;
  entryId: string;
}

export async function deleteLedgerEntry({
  shopId,
  deviceId,
  entryId,
}: DeleteLedgerEntryInput): Promise<boolean> {
  const db = await getDatabase();

  const ledgerRepository = new LedgerRepository();

  const deletedAt = new Date().toISOString();
  const operationId = Crypto.randomUUID();

  let deleted = false;

  const performDeletion = async (
    tx: SQLiteDatabase
  ): Promise<void> => {
    // Validate that the ledger entry belongs to this shop.
    const entry = await tx.getFirstAsync<{ id: string }>(
      `SELECT le.id
       FROM ledger_entries le
       JOIN customers c ON c.id = le.customer_id
       WHERE le.id = ?
         AND c.shop_id = ?
       LIMIT 1`,
      entryId,
      shopId
    );

    if (!entry) {
      throw new Error('Ledger entry not found');
    }

    // Validate the device.
    const device = await tx.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM devices
       WHERE id = ?
         AND shop_id = ?
       LIMIT 1`,
      deviceId,
      shopId
    );

    if (!device) {
      throw new Error('Device not found');
    }

    // Soft-delete the ledger entry.
    deleted = await ledgerRepository.softDeleteWithDatabase(
      tx,
      entryId,
      deviceId,
      deletedAt
    );

    if (!deleted) {
      return;
    }

    // Queue deletion for synchronization.
    await syncOutboxRepository.enqueueWithDatabase(tx, {
      id: operationId,
      shopId,
      deviceId,
      operationType: 'LEDGER_ENTRY_DELETE',
      entityType: 'LEDGER_ENTRY',
      entityId: entryId,
      createdAt: deletedAt,
      payload: {
        entry: {
          id: entryId,
          deletedAt,
          deletedByDeviceId: deviceId,
        },
      },
    });
  };

  console.log('[ledger-delete] starting', {
    entryId,
    platform: Platform.OS,
  });

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      await performDeletion(db);
    });
  } else {
    await db.withExclusiveTransactionAsync(performDeletion);
  }

  console.log('[ledger-delete] completed', {
    entryId,
    deleted,
  });

  return deleted;
}