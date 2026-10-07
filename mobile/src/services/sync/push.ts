// src/sync/push.ts

import {
  syncOutboxRepository,
  type SyncOutboxRecord,
} from '@/repositories/sync-outbox';

import {
  pushSync,
  type SyncPushOperation,
} from '@/api/syncApi';

const PUSH_BATCH_SIZE = 100;
const RETRY_DELAY_MS = 30_000;

export interface PushPendingResult {
  pushed: number;
  remaining: number;
}

/**
 * Push currently eligible outbox operations to the server.
 *
 * Rules:
 * - Operations keep their original IDs across retries.
 * - Only server-acknowledged operations are removed.
 * - Failed operations remain in the outbox.
 * - A single request contains operations for one shop/device identity.
 */
export async function pushPendingOperations(): Promise<PushPendingResult> {
  const now = new Date().toISOString();

  const pending =
    await syncOutboxRepository.getPending(
      PUSH_BATCH_SIZE,
      now
    );

  if (pending.length === 0) {
    return {
      pushed: 0,
      remaining: 0,
    };
  }

  /*
   * /sync/push accepts one shopId/deviceId pair per request.
   *
   * Do not mix operations from different identities.
   */
  const first = pending[0];

  const batch = pending.filter(
    (operation) =>
      operation.shopId === first.shopId &&
      operation.deviceId === first.deviceId
  );

  const attemptedAt = new Date().toISOString();

  for (const operation of batch) {
    await syncOutboxRepository.markAttemptStarted(
      operation.id,
      attemptedAt
    );
  }

  try {
    const response = await pushSync({
      shopId: first.shopId,
      deviceId: first.deviceId,
      operations: batch.map(toPushOperation),
    });

    validateAcknowledgements(
      batch,
      response.acknowledgedOperationIds
    );

    await syncOutboxRepository.removeAcknowledged(
      response.acknowledgedOperationIds
    );

    const remaining =
      await syncOutboxRepository.countPending();

    return {
      pushed: response.acknowledgedOperationIds.length,
      remaining,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();

    const nextAttemptAt = new Date(
      Date.now() + RETRY_DELAY_MS
    ).toISOString();

    const errorMessage = getErrorMessage(error);

    for (const operation of batch) {
      await syncOutboxRepository.markAttemptFailed({
        id: operation.id,
        lastAttemptAt: failedAt,
        nextAttemptAt,
        error: errorMessage,
      });
    }

    throw error;
  }
}

function toPushOperation(
  record: SyncOutboxRecord
): SyncPushOperation {
  let payload: unknown;

  try {
    payload = JSON.parse(record.payload);
  } catch {
    throw new Error(
      `Invalid sync payload for operation ${record.id}`
    );
  }

  return {
    id: record.id,
    operationType: record.operationType,
    entityType: record.entityType,
    entityId: record.entityId,
    createdAt: record.createdAt,
    payload,
  };
}

/**
 * Never delete an outbox row unless the server acknowledged
 * an operation that was actually included in this request.
 */
function validateAcknowledgements(
  batch: SyncOutboxRecord[],
  acknowledgedIds: string[]
): void {
  const sentIds = new Set(
    batch.map((operation) => operation.id)
  );

  for (const id of acknowledgedIds) {
    if (!sentIds.has(id)) {
      throw new Error(
        `Server acknowledged unknown sync operation ${id}`
      );
    }
  }
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}