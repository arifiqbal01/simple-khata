import {
  syncOutboxRepository,
  type SyncOutboxRecord,
} from '@/repositories/sync/sync-outbox';

import { pushSync } from '@/api/syncApi';

import {
  toPushOperation,
  validateAcknowledgements,
  getErrorMessage,
} from './push-helpers';

const RETRY_DELAY_MS = 30_000;

/**
 * Push one ordered batch for a single
 * shop/device identity.
 *
 * Returns the number of acknowledged operations.
 */
export async function pushBatch(
  batch: SyncOutboxRecord[]
): Promise<number> {
  if (batch.length === 0) {
    return 0;
  }

  const first = batch[0];

  if (!first) {
    return 0;
  }

  /*
   * Validate identity consistency before
   * modifying retry metadata.
   */
  for (const operation of batch) {
    if (
      operation.shopId !== first.shopId ||
      operation.deviceId !== first.deviceId
    ) {
      throw new Error(
        'Sync batch contains mixed shop/device identities'
      );
    }
  }

  const startedOperations: SyncOutboxRecord[] = [];

  try {
    /*
     * Parse payloads before marking attempts.
     * Invalid JSON must not reach the backend.
     */
    const operations = batch.map(toPushOperation);

    const attemptedAt = new Date().toISOString();

    for (const operation of batch) {
      await syncOutboxRepository.markAttemptStarted(
        operation.id,
        attemptedAt
      );

      startedOperations.push(operation);
    }

    const response = await pushSync({
      shopId: first.shopId,
      deviceId: first.deviceId,
      operations,
    });

    /*
     * Reject unknown or duplicate acknowledgements.
     */
    validateAcknowledgements(
      batch,
      response.acknowledgedOperationIds
    );

    /*
     * Only acknowledged operations are removed.
     *
     * A partial acknowledgement is not treated
     * as full success.
     */
    await syncOutboxRepository.removeAcknowledged(
      response.acknowledgedOperationIds
    );

    const acknowledged = new Set(
      response.acknowledgedOperationIds
    );

    const unacknowledged = batch.filter(
      (operation) => !acknowledged.has(operation.id)
    );

    if (unacknowledged.length > 0) {
      await recordFailedAttempts(
        unacknowledged,
        'Server did not acknowledge operation'
      );
    }

    return response.acknowledgedOperationIds.length;
  } catch (error) {
    /*
     * Some operations may already have been removed
     * after successful acknowledgement.
     *
     * Record failures only for rows still present.
     */
    await recordFailedAttempts(
      startedOperations,
      getErrorMessage(error)
    );

    throw error;
  }
}

/**
 * Best-effort retry bookkeeping.
 *
 * Never replace the original network or
 * validation error with a secondary SQLite error.
 */
async function recordFailedAttempts(
  operations: SyncOutboxRecord[],
  errorMessage: string
): Promise<void> {
  if (operations.length === 0) {
    return;
  }

  const failedAt = new Date().toISOString();

  const nextAttemptAt = new Date(
    Date.now() + RETRY_DELAY_MS
  ).toISOString();

  for (const operation of operations) {
    try {
      await syncOutboxRepository.markAttemptFailed({
        id: operation.id,
        lastAttemptAt: failedAt,
        nextAttemptAt,
        error: errorMessage,
      });
    } catch (markError) {
      console.error(
        '[push] markAttemptFailed FAILED',
        operation.id,
        markError
      );
    }
  }
}