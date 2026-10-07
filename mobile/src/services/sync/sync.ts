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
  /*
   * TEMPORARY LEGACY REPAIR
   *
   * Some existing outbox rows were created using an older
   * payload shape that is rejected by the current backend.
   *
   * Repair those rows in place before attempting the push.
   * Original operation IDs are preserved.
   */
  const repaired =
    await syncOutboxRepository.repairLegacyPayloads();

  if (repaired > 0) {
    console.log(
      '[sync] repaired legacy outbox operations:',
      repaired
    );
  }

  /*
   * Push local pending operations first.
   */
  const push = await pushPendingOperations();

  /*
   * Then pull remote changes.
   */
  const pull = await pullRemoteChanges({
    shopId: input.shopId,
    deviceId: input.deviceId,
  });

  return {
    push,
    pull,
  };
}