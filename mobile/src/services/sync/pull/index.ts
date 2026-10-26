
import type { SQLiteDatabase } from 'expo-sqlite';

import { pullSync, type SyncChange } from '@/api/syncApi';
import { runWriteTransaction } from '@/db/write-transaction';
import { syncStateRepository } from '@/repositories/sync/sync-state';

import { applyEntityChange } from './apply-entities';
import { applyLedgerChange } from './apply-ledger';
import { applySupplierItemChange } from './apply-supplier-item';

const PULL_BATCH_SIZE = 100;

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
  const normalizedShopId = shopId.trim();
  const normalizedDeviceId = deviceId.trim();

  if (!normalizedShopId) {
    throw new Error('Shop ID is required');
  }

  if (!normalizedDeviceId) {
    throw new Error('Device ID is required');
  }

  let cursor =
    await syncStateRepository.getPullCursor(normalizedShopId);

  let totalPulled = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await pullSync({
      shopId: normalizedShopId,
      deviceId: normalizedDeviceId,
      cursor,
      limit: PULL_BATCH_SIZE,
    });

    if (
      !Number.isSafeInteger(response.nextCursor) ||
      response.nextCursor < cursor
    ) {
      throw new Error('Invalid pull cursor received');
    }

    if (
      response.hasMore &&
      response.nextCursor === cursor
    ) {
      throw new Error('Pull cursor did not advance');
    }

    /*
     * Apply all changes and save the cursor atomically.
     * Any failure must roll back the entire batch.
     */
    try {
      await runWriteTransaction(async (db) => {
        for (const change of response.changes) {
          try {
            await applyRemoteChange(
              db,
              normalizedShopId,
              change
            );
          } catch (error) {
            console.error('[pull] APPLY FAILED', {
              sequence: change.sequence,
              operationType: change.operationType,
              entityId: change.entityId,
              error,
            });

            throw error;
          }
        }

        await syncStateRepository.setPullCursorWithDatabase(
          db,
          normalizedShopId,
          response.nextCursor
        );
      });
    } catch (error) {
      console.error('[pull] TRANSACTION FAILED', {
        cursor,
        nextCursor: response.nextCursor,
        error,
      });

      throw error;
    }

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
    case 'PARTY_CREATE':
    case 'PARTY_UPDATE':
    case 'PARTY_DELETE':
    case 'ITEM_CREATE':
    case 'ITEM_UPDATE':
    case 'ITEM_DELETE':
      await applyEntityChange(db, shopId, change);
      return;

    case 'SUPPLIER_ITEM_CREATE':
    case 'SUPPLIER_ITEM_UPDATE':
    case 'SUPPLIER_ITEM_DELETE':
      await applySupplierItemChange(db, shopId, change);
      return;

    case 'LEDGER_ENTRY_CREATE':
    case 'LEDGER_ENTRY_DELETE':
      await applyLedgerChange(db, shopId, change);
      return;

    default:
      throw new Error(
        `Unsupported sync operation: ${change.operationType}`
      );
  }
}
