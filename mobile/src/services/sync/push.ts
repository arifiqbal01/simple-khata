
// src/services/sync/push.ts

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

  // STEP 1: Load pending operations
  console.log('[push] getPending starting');

  const pending = await syncOutboxRepository.getPending(
    PUSH_BATCH_SIZE,
    now
  );

  console.log('[push] getPending completed', {
    count: pending.length,
  });

  if (pending.length === 0) {
    console.log('[push] no eligible operations');

    const remaining = await syncOutboxRepository.countPending();

    console.log('[push] countPending completed', {
      remaining,
    });

    return {
      pushed: 0,
      remaining,
    };
  }

  // Do not mix operations from different shop/device identities.
  const first = pending[0];

  const batch = pending.filter(
    (operation) =>
      operation.shopId === first.shopId &&
      operation.deviceId === first.deviceId
  );

  console.log('[push] batch prepared', {
    count: batch.length,
    operationTypes: batch.map((operation) => operation.operationType),
  });

  const attemptedAt = new Date().toISOString();
  const startedOperations: SyncOutboxRecord[] = [];

  try {
    // STEP 2: Mark operations as attempted
    for (const operation of batch) {
      console.log(
        '[push] markAttemptStarted starting',
        operation.id
      );

      await syncOutboxRepository.markAttemptStarted(
        operation.id,
        attemptedAt
      );

      startedOperations.push(operation);

      console.log(
        '[push] markAttemptStarted completed',
        operation.id
      );
    }

    // STEP 3: Send operations to backend
    console.log('[push] preparing API payload');

    const operations = batch.map(toPushOperation);

    console.log('[push] API request starting', {
      count: operations.length,
    });

    const response = await pushSync({
      shopId: first.shopId,
      deviceId: first.deviceId,
      operations,
    });

    console.log('[push] API request completed', {
      acknowledged: response.acknowledgedOperationIds.length,
    });

    // STEP 4: Validate server acknowledgements
    console.log('[push] validating acknowledgements');

    validateAcknowledgements(
      batch,
      response.acknowledgedOperationIds
    );

    console.log('[push] acknowledgements validated');

    // STEP 5: Remove only acknowledged operations
    console.log('[push] removeAcknowledged starting');

    await syncOutboxRepository.removeAcknowledged(
      response.acknowledgedOperationIds
    );

    console.log('[push] removeAcknowledged completed');

    // STEP 6: Count remaining operations
    console.log('[push] countPending starting');

    const remaining =
      await syncOutboxRepository.countPending();

    console.log('[push] countPending completed', {
      remaining,
    });

    console.log('[push] completed successfully');

    return {
      pushed: response.acknowledgedOperationIds.length,
      remaining,
    };
  } catch (error) {
    console.error('[push] FAILED', error);

    const failedAt = new Date().toISOString();

    const nextAttemptAt = new Date(
      Date.now() + RETRY_DELAY_MS
    ).toISOString();

    const errorMessage = getErrorMessage(error);

    // Best-effort failure recording.
    // Never replace the original error with a secondary SQLite error.
    for (const operation of startedOperations) {
      try {
        console.log(
          '[push] markAttemptFailed starting',
          operation.id
        );

        await syncOutboxRepository.markAttemptFailed({
          id: operation.id,
          lastAttemptAt: failedAt,
          nextAttemptAt,
          error: errorMessage,
        });

        console.log(
          '[push] markAttemptFailed completed',
          operation.id
        );
      } catch (markError) {
        console.error(
          '[push] markAttemptFailed FAILED',
          operation.id,
          markError
        );
      }
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
