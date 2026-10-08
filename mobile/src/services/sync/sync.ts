// src/sync/sync.ts

import { syncOutboxRepository } from '@/repositories/sync-outbox';

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
 * This function does NOT manage concurrency.
 * Call it through SyncCoordinator for normal app usage.
 */
export async function syncNow(
  input: SyncNowInput
): Promise<SyncNowResult> {
  console.log('[sync] starting', {
    shopId: input.shopId,
    deviceId: input.deviceId,
  });

  // Stage 1: Repair legacy payloads
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

  // Stage 2: Push local operations
  console.log('[sync] push starting');

  let push: PushPendingResult;

  try {
    push = await pushPendingOperations();

    console.log('[sync] push completed', push);
  } catch (error) {
    console.error('[sync] PUSH FAILED', error);
    throw error;
  }

  // Stage 3: Pull remote changes
  console.log('[sync] pull starting');

  let pull: PullRemoteChangesResult;

  try {
    pull = await pullRemoteChanges({
      shopId: input.shopId,
      deviceId: input.deviceId,
    });

    console.log('[sync] pull completed', pull);
  } catch (error) {
    console.error('[sync] PULL FAILED', error);
    throw error;
  }

  console.log('[sync] completed successfully');

  return {
    push,
    pull,
  };
}