import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '@/db/database';
import { runWriteTransaction } from '@/db/write-transaction';
import { repairLegacyOutboxPayloads } from './sync-outbox-repair';

export type SyncEntityType =
  | 'CUSTOMER'
  | 'PARTY'
  | 'ITEM'
  | 'SUPPLIER_ITEM'
  | 'LEDGER_ENTRY';

export type SyncOperationType =
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_UPDATE'
  | 'PARTY_CREATE'
  | 'PARTY_UPDATE'
  | 'PARTY_DELETE'
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'ITEM_DELETE'
  | 'SUPPLIER_ITEM_CREATE'
  | 'SUPPLIER_ITEM_UPDATE'
  | 'SUPPLIER_ITEM_DELETE'
  | 'LEDGER_ENTRY_CREATE'
  | 'LEDGER_ENTRY_DELETE';

export interface SyncOutboxRecord {
  id: string;
  shopId: string;
  deviceId: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface SyncOutboxRow {
  id: string;
  shop_id: string;
  device_id: string;
  operation_type: SyncOperationType;
  entity_type: SyncEntityType;
  entity_id: string;
  payload: string;
  attempt_count: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface EnqueueSyncOperationInput {
  id: string;
  shopId: string;
  deviceId: string;
  operationType: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: unknown;
  createdAt: string;
}

export interface MarkSyncAttemptFailedInput {
  id: string;
  nextAttemptAt: string;
  lastAttemptAt: string;
  error: string;
}

export class SyncOutboxRepository {

async enqueueWithDatabase(
  db: SQLiteDatabase,
  input: EnqueueSyncOperationInput
): Promise<void> {
  const payload = JSON.stringify(input.payload);

  if (payload === undefined) {
    throw new Error(
      'Sync payload must be JSON-serializable'
    );
  }

  console.log('[outbox] INSERT starting', {
    operationType: input.operationType,
    entityType: input.entityType,
    entityId: input.entityId,
    payloadLength: payload.length,
  });

  try {
    await db.runAsync(
      `INSERT INTO sync_outbox (
        id,
        shop_id,
        device_id,
        operation_type,
        entity_type,
        entity_id,
        payload,
        attempt_count,
        next_attempt_at,
        last_attempt_at,
        last_error,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?)`,
      input.id,
      input.shopId,
      input.deviceId,
      input.operationType,
      input.entityType,
      input.entityId,
      payload,
      input.createdAt
    );

    console.log('[outbox] INSERT succeeded');
  } catch (error) {
    console.error('[outbox] INSERT failed', error);

    // Diagnostic reads only; no data or schema changes.
    try {
      const schema = await db.getFirstAsync<{
        sql: string | null;
      }>(
        `SELECT sql
         FROM sqlite_master
         WHERE type = 'table'
           AND name = 'sync_outbox'`
      );

      console.log(
        '[outbox] Existing table schema:',
        schema?.sql ?? 'TABLE NOT FOUND'
      );

      const columns = await db.getAllAsync(
        'PRAGMA table_info(sync_outbox)'
      );

      console.log(
        '[outbox] Existing table columns:',
        columns
      );

      const foreignKeys = await db.getAllAsync(
        'PRAGMA foreign_key_list(sync_outbox)'
      );

      console.log(
        '[outbox] Foreign keys:',
        foreignKeys
      );
    } catch (diagnosticError) {
      console.warn(
        '[outbox] Schema diagnostics unavailable:',
        diagnosticError
      );
    }

    throw error;
  }
}


  async enqueue(input: EnqueueSyncOperationInput): Promise<void> {
    await runWriteTransaction(async db => {
      await this.enqueueWithDatabase(db, input);
    });
  }

  async getPending(limit: number, now: string): Promise<SyncOutboxRecord[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid outbox limit');
    const db = await getDatabase();
    // rowid is the insertion order; do not allow a later DELETE to overtake CREATE.
    const rows = await db.getAllAsync<SyncOutboxRow>(
      `SELECT id, shop_id, device_id, operation_type, entity_type, entity_id,
        payload, attempt_count, next_attempt_at, last_attempt_at, last_error, created_at
       FROM sync_outbox ORDER BY rowid ASC LIMIT ?`,
      limit
    );
    const eligible: SyncOutboxRow[] = [];
    for (const row of rows) {
      if (row.next_attempt_at !== null && row.next_attempt_at > now) break;
      eligible.push(row);
    }
    return eligible.map(mapRow);
  }

  async removeAcknowledged(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await runWriteTransaction(async db => {
      for (const id of ids) {
        await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', id);
      }
    });
  }

  async markAttemptFailed(input: MarkSyncAttemptFailedInput): Promise<void> {
    await runWriteTransaction(async db => {
      await db.runAsync(
        `UPDATE sync_outbox SET attempt_count = attempt_count + 1,
          next_attempt_at = ?, last_attempt_at = ?, last_error = ? WHERE id = ?`,
        input.nextAttemptAt, input.lastAttemptAt, input.error, input.id
      );
    });
  }

  async markAttemptStarted(id: string, attemptedAt: string): Promise<void> {
    await runWriteTransaction(async db => {
      await db.runAsync('UPDATE sync_outbox SET last_attempt_at = ? WHERE id = ?', attemptedAt, id);
    });
  }

  async clearError(id: string): Promise<void> {
    await runWriteTransaction(async db => {
      await db.runAsync(
        'UPDATE sync_outbox SET next_attempt_at = NULL, last_error = NULL WHERE id = ?', id
      );
    });
  }

  async countPending(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox'
    );
    return row?.count ?? 0;
  }

  async hasPendingForEntity(entityType: SyncEntityType, entityId: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox WHERE entity_type = ? AND entity_id = ?',
      entityType, entityId
    );
    return (row?.count ?? 0) > 0;
  }

  async repairLegacyPayloads(): Promise<number> {
    return repairLegacyOutboxPayloads();
  }
}

function mapRow(row: SyncOutboxRow): SyncOutboxRecord {
  return {
    id: row.id, shopId: row.shop_id, deviceId: row.device_id,
    operationType: row.operation_type, entityType: row.entity_type,
    entityId: row.entity_id, payload: row.payload,
    attemptCount: row.attempt_count, nextAttemptAt: row.next_attempt_at,
    lastAttemptAt: row.last_attempt_at, lastError: row.last_error,
    createdAt: row.created_at,
  };
}

export const syncOutboxRepository = new SyncOutboxRepository();
