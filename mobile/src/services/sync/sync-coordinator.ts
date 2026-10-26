
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import {
  SyncOutboxRepository,
} from '@/repositories/sync/sync-outbox';

import {
  syncNow,
  type SyncNowResult,
} from '@/services/sync/sync';

const localIdentityRepository =
  new LocalIdentityRepository();

const syncOutboxRepository =
  new SyncOutboxRepository();

/**
 * Only one sync cycle can run at a time
 * within this JavaScript runtime.
 */
let activeSync: Promise<SyncNowResult> | null = null;

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;

  /**
   * Incremented after each successful sync.
   *
   * Screens can subscribe to this value
   * and reload their local SQLite data.
   */
  dataVersion: number;
}

let syncState: SyncState = {
  status: 'idle',
  pendingCount: 0,
  lastError: null,
  lastSyncedAt: null,
  dataVersion: 0,
};

type SyncStateListener = () => void;

const listeners = new Set<SyncStateListener>();

/**
 * Return the current immutable state snapshot.
 *
 * Compatible with useSyncExternalStore.
 */
export function getSyncState(): SyncState {
  return syncState;
}

/**
 * Subscribe to coordinator state changes.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToSyncState(
  listener: SyncStateListener
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Refresh the pending outbox count.
 *
 * This does not start a network sync.
 */
export async function refreshSyncState(): Promise<void> {
  const pendingCount =
    await syncOutboxRepository.countPending();

  updateSyncState({
    pendingCount,
  });
}

/**
 * Request a synchronization cycle.
 *
 * Concurrent callers join the same promise.
 *
 * A completed sync releases the lock so
 * another request can start a new cycle.
 */

export function requestSync(): Promise<SyncNowResult> {
  if (activeSync) {
    console.log(
      '[sync-coordinator] joining active sync'
    );

    return activeSync;
  }

  console.log(
    '[sync-coordinator] checking installation identity'
  );

  const syncPromise = (async (): Promise<SyncNowResult> => {
    const identity =
      await localIdentityRepository.get();

    if (!identity) {
      updateSyncState({
        status: 'idle',
        lastError: null,
      });

      throw new Error(
        'Sync unavailable: installation setup is not complete'
      );
    }

    const shopId = identity.shopId?.trim();
    const deviceId = identity.deviceId?.trim();

    if (!shopId || !deviceId) {
      updateSyncState({
        status: 'idle',
        lastError: null,
      });

      throw new Error(
        'Sync unavailable: local installation identity is incomplete'
      );
    }

    updateSyncState({
      status: 'syncing',
      lastError: null,
    });

    try {
      const result = await syncNow({
        shopId,
        deviceId,
      });

      let pendingCount = result.push.remaining;

      try {
        pendingCount =
          await syncOutboxRepository.countPending();
      } catch (countError) {
        console.warn(
          '[sync-coordinator] pending count refresh failed',
          countError
        );
      }

      updateSyncState({
        status: 'synced',
        pendingCount,
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
        dataVersion: syncState.dataVersion + 1,
      });

      console.log(
        '[sync-coordinator] sync completed',
        {
          pushed: result.push.pushed,
          pulled: result.pull.pulled,
          remaining: pendingCount,
        }
      );

      return result;
    } catch (error) {
      console.error(
        '[sync-coordinator] sync failed',
        error
      );

      let pendingCount = syncState.pendingCount;

      try {
        pendingCount =
          await syncOutboxRepository.countPending();
      } catch (countError) {
        console.warn(
          '[sync-coordinator] failed to count pending operations',
          countError
        );
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      updateSyncState({
        status: 'error',
        pendingCount,
        lastError: message,
      });

      throw error;
    }
  })();

  activeSync = syncPromise;

  void syncPromise.finally(() => {
    if (activeSync === syncPromise) {
      activeSync = null;
    }
  }).catch(() => {
    // The original promise carries the error to its caller.
  });

  return syncPromise;
}


/**
 * Resolve the local installation identity
 * and execute one complete sync cycle.
 *
 * The identity comes from local SQLite.
 * It must not be generated during sync.
 */
async function performSyncRequest(): Promise<SyncNowResult> {
  const identity =
    await localIdentityRepository.get();

  if (!identity) {
    throw new Error(
      'No local installation identity found'
    );
  }

  const shopId = identity.shopId.trim();
  const deviceId = identity.deviceId.trim();

  if (!shopId || !deviceId) {
    throw new Error(
      'Local installation identity is incomplete'
    );
  }

  return syncNow({
    shopId,
    deviceId,
  });
}

/**
 * Publish a new state snapshot.
 *
 * Each update creates a new object so
 * React external-store subscriptions can
 * detect the change.
 */
function updateSyncState(
  patch: Partial<SyncState>
): void {
  syncState = {
    ...syncState,
    ...patch,
  };

  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      /*
       * A broken subscriber must not interrupt
       * synchronization or other subscribers.
       */
      console.error(
        '[sync-coordinator] state listener failed',
        error
      );
    }
  }
}
