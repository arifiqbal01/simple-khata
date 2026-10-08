import { LocalIdentityRepository } from '@/repositories/local-identity';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import {
  syncNow,
  type SyncNowResult,
} from '@/services/sync/sync';

const localIdentityRepository =
  new LocalIdentityRepository();

const syncOutboxRepository =
  new SyncOutboxRepository();

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
   * Incremented after every successful sync.
   * Screens can subscribe to this to reload local SQLite data.
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

export function getSyncState(): SyncState {
  return syncState;
}

export function subscribeToSyncState(
  listener: SyncStateListener
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export async function refreshSyncState(): Promise<void> {
  const pendingCount =
    await syncOutboxRepository.countPending();

  updateSyncState({
    pendingCount,
  });
}

export function requestSync(): Promise<SyncNowResult> {
  if (activeSync) {
    console.log(
      '[sync-coordinator] joining active sync'
    );

    return activeSync;
  }

  console.log(
    '[sync-coordinator] starting new sync'
  );

  updateSyncState({
    status: 'syncing',
    lastError: null,
  });

  activeSync = performSyncRequest()
    .then(async (result) => {
      const pendingCount =
        await syncOutboxRepository.countPending();

      updateSyncState({
        status: 'synced',
        pendingCount,
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
        dataVersion: syncState.dataVersion + 1,
      });

      return result;
    })
    .catch(async (error) => {
      console.error(
        '[sync-coordinator] sync failed:',
        error
      );

      let pendingCount = syncState.pendingCount;

      try {
        pendingCount =
          await syncOutboxRepository.countPending();
      } catch (countError) {
        console.error(
          '[sync-coordinator] failed to count pending operations:',
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
    })
    .finally(() => {
      console.log(
        '[sync-coordinator] sync finished'
      );

      activeSync = null;
    });

  return activeSync;
}

async function performSyncRequest(): Promise<SyncNowResult> {
  const identity =
    await localIdentityRepository.get();

  if (!identity) {
    throw new Error(
      'No local installation identity found'
    );
  }

  return syncNow({
    shopId: identity.shopId,
    deviceId: identity.deviceId,
  });
}

function updateSyncState(
  patch: Partial<SyncState>
): void {
  syncState = {
    ...syncState,
    ...patch,
  };

  for (const listener of listeners) {
    listener();
  }
}