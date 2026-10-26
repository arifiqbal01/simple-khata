
import {
  syncOutboxRepository,
} from '@/repositories/sync/sync-outbox';

import {
  pullRemoteChanges,
  type PullRemoteChangesResult,
} from '@/services/sync/pull';

import {
  pushPendingOperations,
  type PushPendingResult,
} from '@/services/sync/push';

export interface SyncNowInput {
  shopId: string;
  deviceId: string;
}

export interface SyncNowResult {
  push: PushPendingResult;
  pull: PullRemoteChangesResult;
}

/**
 * Run one complete synchronization cycle.
 *
 * Stages:
 * 1. Repair legacy outbox payloads.
 * 2. Push local operations.
 * 3. Pull remote changes.
 *
 * This function does not manage concurrency.
 * Normal app usage must go through SyncCoordinator.
 */
export async function syncNow(
  input: SyncNowInput
): Promise<SyncNowResult> {
  const shopId = input.shopId.trim();
  const deviceId = input.deviceId.trim();

  if (!shopId) {
    throw new Error('Shop ID is required');
  }

  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  console.log('[sync] starting', {
    shopId,
    deviceId,
  });

  /*
   * Stage 1: Repair legacy outbox payloads.
   *
   * Important for existing installations
   * migrating from customer-based sync
   * to party-based sync.
   */
  console.log('[sync] repair starting');

  let repaired: number;

  try {
    repaired =
      await syncOutboxRepository.repairLegacyPayloads();

    console.log('[sync] repair completed', {
      repaired,
    });
  } catch (error) {
    console.error('[sync] REPAIR FAILED', error);
    throw error;
  }

  /*
   * Stage 2: Push local changes.
   *
   * Push first so that the backend receives
   * locally created parties, items, and
   * ledger entries before the next pull.
   */
  console.log('[sync] push starting');

  let push: PushPendingResult;

  try {
    push = await pushPendingOperations();

    console.log('[sync] push completed', push);
  } catch (error) {
    console.error('[sync] PUSH FAILED', error);
    throw error;
  }

  /*
   * Stage 3: Pull remote changes.
   *
   * Each pull batch must commit its SQLite
   * changes and cursor atomically.
   */
  console.log('[sync] pull starting');

  let pull: PullRemoteChangesResult;

  try {
    pull = await pullRemoteChanges({
      shopId,
      deviceId,
    });

    console.log('[sync] pull completed', pull);
  } catch (error) {
    console.error('[sync] PULL FAILED', error);
    throw error;
  }

  console.log('[sync] completed successfully', {
    pushed: push.pushed,
    remaining: push.remaining,
    pulled: pull.pulled,
    cursor: pull.cursor,
  });

  return {
    push,
    pull,
  };
}
