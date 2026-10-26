
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import { LedgerRepository } from '@/repositories/ledger/ledger';
import { syncOutboxRepository } from '@/repositories/sync/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';

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
  const normalizedShopId = shopId.trim();
  const normalizedDeviceId = deviceId.trim();
  const normalizedEntryId = entryId.trim();

  if (!normalizedShopId) {
    throw new Error('Shop ID is required');
  }

  if (!normalizedDeviceId) {
    throw new Error('Device ID is required');
  }

  if (!normalizedEntryId) {
    throw new Error('Ledger entry ID is required');
  }

  const db = await getDatabase();
  const ledgerRepository = new LedgerRepository();

  const deletedAt = new Date().toISOString();
  const operationId = Crypto.randomUUID();

  const performDeletion = async (
    tx: SQLiteDatabase
  ): Promise<boolean> => {
    /*
     * Verify that the ledger entry belongs to
     * this shop through its Party.
     *
     * Do not filter deleted Parties here:
     * historical entries must remain addressable.
     */
    const entry = await tx.getFirstAsync<{
      id: string;
      deleted_at: string | null;
    }>(
      `
        SELECT
          le.id,
          le.deleted_at
        FROM ledger_entries AS le

        INNER JOIN parties AS p
          ON p.id = le.party_id

        WHERE le.id = ?
          AND p.shop_id = ?

        LIMIT 1
      `,
      normalizedEntryId,
      normalizedShopId
    );

    if (!entry) {
      throw new Error('Ledger entry not found');
    }

    /*
     * Idempotency: do not enqueue another deletion
     * if the entry was already soft-deleted.
     */
    if (entry.deleted_at !== null) {
      return false;
    }

    /*
     * Validate that the device belongs to
     * the same shop.
     */
    const device = await tx.getFirstAsync<{
      id: string;
    }>(
      `
        SELECT id
        FROM devices
        WHERE id = ?
          AND shop_id = ?
        LIMIT 1
      `,
      normalizedDeviceId,
      normalizedShopId
    );

    if (!device) {
      throw new Error('Device not found');
    }

    /*
     * Soft-delete the ledger entry.
     * Historical entry_items remain intact.
     */
    const deleted =
      await ledgerRepository.softDeleteWithDatabase(
        tx,
        normalizedEntryId,
        normalizedDeviceId,
        deletedAt
      );

    if (!deleted) {
      return false;
    }

    /*
     * The deletion and outbox operation must
     * commit in the same transaction.
     */
    await syncOutboxRepository.enqueueWithDatabase(
      tx,
      {
        id: operationId,
        shopId: normalizedShopId,
        deviceId: normalizedDeviceId,

        operationType: 'LEDGER_ENTRY_DELETE',
        entityType: 'LEDGER_ENTRY',
        entityId: normalizedEntryId,

        createdAt: deletedAt,

        payload: {
          entry: {
            id: normalizedEntryId,
            deletedAt,
            deletedByDeviceId: normalizedDeviceId,
          },
        },
      }
    );

    return true;
  };

  console.log('[ledger-delete] starting', {
    entryId: normalizedEntryId,
    platform: Platform.OS,
  });

  let deleted = false;

  if (Platform.OS === 'web') {
    let transactionResult = false;

    await db.withTransactionAsync(async () => {
      transactionResult = await performDeletion(db);
    });

    deleted = transactionResult;
  } else {
    await db.withExclusiveTransactionAsync(async (tx) => {
      deleted = await performDeletion(tx);
    });
  }

  console.log('[ledger-delete] completed', {
    entryId: normalizedEntryId,
    deleted,
  });

  /*
   * Only request sync after the transaction
   * commits and a new deletion was recorded.
   */
  if (deleted) {
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] ledger-delete failed',
        error
      );
    });
  }

  return deleted;
}
