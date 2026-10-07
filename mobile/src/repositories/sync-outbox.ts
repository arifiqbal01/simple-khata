import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../db/database';

export type SyncEntityType =
  | 'CUSTOMER'
  | 'ITEM'
  | 'LEDGER_ENTRY';

export type SyncOperationType =
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_UPDATE'
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'LEDGER_ENTRY_CREATE';

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
  /**
   * Insert an outbox operation using an existing transaction/database
   * connection.
   *
   * IMPORTANT:
   * Financial/domain services should use this method while they are already
   * inside the same SQLite transaction that writes the domain data.
   */
  async enqueueWithDatabase(
    db: SQLiteDatabase,
    input: EnqueueSyncOperationInput,
  ): Promise<void> {
    const payload = JSON.stringify(input.payload);

    await db.runAsync(
      `
        INSERT INTO sync_outbox (
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
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?)
      `,
      input.id,
      input.shopId,
      input.deviceId,
      input.operationType,
      input.entityType,
      input.entityId,
      payload,
      input.createdAt,
    );
  }

  /**
   * Convenience method for non-financial operations.
   *
   * Do NOT use this after separately committing a financial/domain write.
   * Financial writes and their outbox operation must be committed atomically.
   */
  async enqueue(
    input: EnqueueSyncOperationInput,
  ): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.enqueueWithDatabase(db, input);
    });
  }

  /**
   * Return operations currently eligible to be pushed.
   *
   * Rows with next_attempt_at = NULL have never failed and can be sent
   * immediately.
   *
   * Failed operations become eligible again once their retry time arrives.
   */
  async getPending(
    limit: number,
    now: string,
  ): Promise<SyncOutboxRecord[]> {
    const db = await getDatabase();

    const rows =
      await db.getAllAsync<SyncOutboxRow>(
        `
          SELECT
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
          FROM sync_outbox
          WHERE
            next_attempt_at IS NULL
            OR next_attempt_at <= ?
          ORDER BY created_at ASC
          LIMIT ?
        `,
        now,
        limit,
      );

    return rows.map(mapRow);
  }

  /**
   * Remove operations acknowledged by the server.
   *
   * An outbox operation must only be deleted after the server has explicitly
   * acknowledged the operation ID.
   */
  async removeAcknowledged(
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      for (const id of ids) {
        await db.runAsync(
          `
            DELETE FROM sync_outbox
            WHERE id = ?
          `,
          id,
        );
      }
    });
  }

  /**
   * Record a failed push attempt.
   *
   * The row remains in the outbox so the same operation ID can be retried.
   */
  async markAttemptFailed(
    input: MarkSyncAttemptFailedInput,
  ): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      `
        UPDATE sync_outbox
        SET
          attempt_count = attempt_count + 1,
          next_attempt_at = ?,
          last_attempt_at = ?,
          last_error = ?
        WHERE id = ?
      `,
      input.nextAttemptAt,
      input.lastAttemptAt,
      input.error,
      input.id,
    );
  }

  /**
   * Record that an operation is about to be attempted.
   *
   * We intentionally do not increment attempt_count here.
   * attempt_count represents failed attempts.
   */
  async markAttemptStarted(
    id: string,
    attemptedAt: string,
  ): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      `
        UPDATE sync_outbox
        SET
          last_attempt_at = ?
        WHERE id = ?
      `,
      attemptedAt,
      id,
    );
  }

  /**
   * Clear retry/error metadata.
   *
   * Useful if an operation previously failed but should become immediately
   * eligible for another attempt.
   */
  async clearError(id: string): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      `
        UPDATE sync_outbox
        SET
          next_attempt_at = NULL,
          last_error = NULL
        WHERE id = ?
      `,
      id,
    );
  }

  /**
   * Number of operations still waiting for server acknowledgement.
   */
  async countPending(): Promise<number> {
    const db = await getDatabase();

    const result = await db.getFirstAsync<{
      count: number;
    }>(
      `
        SELECT COUNT(*) AS count
        FROM sync_outbox
      `,
    );

    return result?.count ?? 0;
  }

  /**
   * Check whether an entity currently has local work waiting to sync.
   */
  async hasPendingForEntity(
    entityType: SyncEntityType,
    entityId: string,
  ): Promise<boolean> {
    const db = await getDatabase();

    const result = await db.getFirstAsync<{
      count: number;
    }>(
      `
        SELECT COUNT(*) AS count
        FROM sync_outbox
        WHERE entity_type = ?
          AND entity_id = ?
      `,
      entityType,
      entityId,
    );

    return (result?.count ?? 0) > 0;
  }

  /**
   * Repair legacy queued payloads created before the
   * current server sync contract.
   *
   * Important:
   * - keeps the original operation ID
   * - keeps the original entity ID
   * - does not delete/re-enqueue operations
   * - clears retry state after a successful repair
   * - safe to run more than once
   */
  async repairLegacyPayloads(): Promise<number> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    operation_type: SyncOperationType;
    payload: string;
  }>(
    `
      SELECT
        id,
        operation_type,
        payload
      FROM sync_outbox
      WHERE operation_type IN (
        'CUSTOMER_CREATE',
        'CUSTOMER_UPDATE',
        'ITEM_CREATE',
        'ITEM_UPDATE',
        'LEDGER_ENTRY_CREATE'
      )
      ORDER BY created_at ASC
    `,
  );

  let repairedCount = 0;

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      let payload: any;

      try {
        payload = JSON.parse(row.payload);
      } catch {
        console.warn(
          '[sync-outbox] invalid JSON payload',
          row.id,
        );
        continue;
      }

      let changed = false;

      /*
       * Repair customer payload from domain snake_case
       * to the camelCase sync API contract.
       */
      if (
        (row.operation_type === 'CUSTOMER_CREATE' ||
          row.operation_type === 'CUSTOMER_UPDATE') &&
        payload?.customer
      ) {
        const customer = payload.customer;

        if (
          customer.shop_id ||
          customer.created_at ||
          customer.updated_at
        ) {
          payload.customer = {
            id: customer.id,
            shopId: customer.shopId ?? customer.shop_id,
            name: customer.name,
            phone: customer.phone ?? null,
            createdAt:
              customer.createdAt ?? customer.created_at,
            updatedAt:
              customer.updatedAt ?? customer.updated_at,
          };

          changed = true;
        }
      }

      /*
       * Repair item payload and ensure updatedAt exists.
       */
      if (
        (row.operation_type === 'ITEM_CREATE' ||
          row.operation_type === 'ITEM_UPDATE') &&
        payload?.item
      ) {
        const item = payload.item;

        if (
          item.shop_id ||
          item.created_at ||
          !item.updatedAt
        ) {
          const createdAt =
            item.createdAt ?? item.created_at;

          payload.item = {
            id: item.id,
            shopId: item.shopId ?? item.shop_id,
            name: item.name,
            createdAt,
            updatedAt:
              item.updatedAt ??
              item.updated_at ??
              createdAt,
          };

          changed = true;
        }
      }

      /*
       * Repair ledger entry and entry-item payloads.
       */
      if (
        row.operation_type === 'LEDGER_ENTRY_CREATE' &&
        payload?.entry
      ) {
        const entry = payload.entry;

        if (
          entry.customer_id ||
          entry.device_id ||
          entry.occurred_at ||
          entry.created_at
        ) {
          payload.entry = {
            id: entry.id,
            customerId:
              entry.customerId ?? entry.customer_id,
            deviceId:
              entry.deviceId ?? entry.device_id,
            type: entry.type,
            amount: entry.amount,
            note: entry.note ?? null,
            occurredAt:
              entry.occurredAt ?? entry.occurred_at,
            createdAt:
              entry.createdAt ?? entry.created_at,
          };

          changed = true;
        }

        if (Array.isArray(payload.items)) {
          payload.items = payload.items.map(
            (item: any) => {
              const repairedItem = {
                ...item,
              };

              if (!repairedItem.ledgerEntryId) {
                repairedItem.ledgerEntryId =
                  payload.entry.id;
                changed = true;
              }

              if (
                !repairedItem.itemName &&
                repairedItem.name
              ) {
                repairedItem.itemName =
                  repairedItem.name;
                changed = true;
              }

              if (!repairedItem.createdAt) {
                repairedItem.createdAt =
                  payload.entry.createdAt;
                changed = true;
              }

              if ('name' in repairedItem) {
                delete repairedItem.name;
                changed = true;
              }

              return repairedItem;
            },
          );
        }
      }

      if (!changed) {
        continue;
      }

      await db.runAsync(
        `
          UPDATE sync_outbox
          SET
            payload = ?,
            next_attempt_at = NULL,
            last_error = NULL
          WHERE id = ?
        `,
        JSON.stringify(payload),
        row.id,
      );

      repairedCount += 1;

      console.log(
        '[sync-outbox] repaired',
        row.id,
        row.operation_type,
      );
    }
  });

  return repairedCount;
}
}

function mapRow(
  row: SyncOutboxRow,
): SyncOutboxRecord {
  return {
    id: row.id,

    shopId: row.shop_id,
    deviceId: row.device_id,

    operationType: row.operation_type,
    entityType: row.entity_type,
    entityId: row.entity_id,

    payload: row.payload,

    attemptCount: row.attempt_count,

    nextAttemptAt: row.next_attempt_at,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,

    createdAt: row.created_at,
  };
}

export const syncOutboxRepository =
  new SyncOutboxRepository();