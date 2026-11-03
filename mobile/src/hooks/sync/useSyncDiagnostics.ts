
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  getSyncState,
  subscribeToSyncState,
  refreshSyncState,
  requestSync,
} from '@/services/sync/sync-coordinator';

import {
  syncOutboxRepository,
  type SyncOutboxDiagnostic,
} from '@/repositories/sync/sync-outbox';

const DIAGNOSTICS_LIMIT = 50;

export function useSyncDiagnostics() {
  const syncState = useSyncExternalStore(
    subscribeToSyncState,
    getSyncState,
    getSyncState
  );

  const [operations, setOperations] = useState<
    SyncOutboxDiagnostic[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<
    string | null
  >(null);

  const loadDiagnostics = useCallback(async () => {
    try {
      const rows = await syncOutboxRepository.getDiagnostics(
        DIAGNOSTICS_LIMIT
      );

      setOperations(rows);
      setDiagnosticsError(null);
    } catch (error) {
      setDiagnosticsError(
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await refreshSyncState();
      await loadDiagnostics();
    } catch (error) {
      setDiagnosticsError(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadDiagnostics]);

  const retrySync = useCallback(async () => {
    if (retrying || syncState.status === 'syncing') {
      return;
    }

    setRetrying(true);

    try {
      await requestSync();
    } catch {
      // The coordinator records the sync error.
    } finally {
      try {
        await refresh();
      } finally {
        setRetrying(false);
      }
    }
  }, [retrying, syncState.status, refresh]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await refreshSyncState();

        const rows =
          await syncOutboxRepository.getDiagnostics(
            DIAGNOSTICS_LIMIT
          );

        if (active) {
          setOperations(rows);
          setDiagnosticsError(null);
        }
      } catch (error) {
        if (active) {
          setDiagnosticsError(
            error instanceof Error
              ? error.message
              : String(error)
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  return {
    status: syncState.status,
    pendingCount: syncState.pendingCount,
    lastError: syncState.lastError,
    lastSyncedAt: syncState.lastSyncedAt,

    operations,
    loading,
    refreshing,
    retrying,
    diagnosticsError,

    refresh,
    retrySync,
  };
}
