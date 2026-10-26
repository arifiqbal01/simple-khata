
import {
  syncOutboxRepository,
  type SyncOutboxRecord,
} from '@/repositories/sync/sync-outbox';

import { pushBatch } from './push-batch';

const PUSH_BATCH_SIZE = 100;

export interface PushPendingResult {
  pushed: number;
  remaining: number;
}

/**
 * Push currently eligible outbox operations.
 *
 * Rules:
 * - Preserve original operation IDs.
 * - Preserve FIFO order.
 * - Never mix shop/device identities.
 * - Remove only acknowledged operations.
 * - Leave failed operations available for retry.
 */
export async function pushPendingOperations(): Promise<PushPendingResult> {
  console.log('[push] getPending starting');

  const pending = await syncOutboxRepository.getPending(
    PUSH_BATCH_SIZE,
    new Date().toISOString()
  );

  console.log('[push] getPending completed', {
    count: pending.length,
  });

  if (pending.length === 0) {
    const remaining =
      await syncOutboxRepository.countPending();

    return {
      pushed: 0,
      remaining,
    };
  }

  const batch = selectContiguousBatch(pending);

  console.log('[push] batch prepared', {
    count: batch.length,
    operationTypes: batch.map(
      (operation) => operation.operationType
    ),
  });

  const pushed = await pushBatch(batch);

  const remaining =
    await syncOutboxRepository.countPending();

  console.log('[push] completed', {
    pushed,
    remaining,
  });

  return {
    pushed,
    remaining,
  };
}

/**
 * Select only the first contiguous group of
 * operations sharing the same shop/device.
 *
 * Do not use filter() across the entire queue:
 * that could skip earlier operations and
 * violate global FIFO ordering.
 */
function selectContiguousBatch(
  pending: SyncOutboxRecord[]
): SyncOutboxRecord[] {
  const first = pending[0];

  if (!first) {
    return [];
  }

  const batch: SyncOutboxRecord[] = [];

  for (const operation of pending) {
    if (
      operation.shopId !== first.shopId ||
      operation.deviceId !== first.deviceId
    ) {
      break;
    }

    batch.push(operation);
  }

  return batch;
}
