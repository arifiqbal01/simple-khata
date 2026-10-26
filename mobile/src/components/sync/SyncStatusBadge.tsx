
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import {
  getSyncState,
  refreshSyncState,
  requestSync,
  subscribeToSyncState,
  type SyncStatus,
} from '@/services/sync/sync-coordinator';

import { AppText } from '@/components/ui';

export interface SyncStatusBadgeProps {
  className?: string;
}

type SyncState = ReturnType<typeof getSyncState>;

export function SyncStatusBadge({
  className = '',
}: SyncStatusBadgeProps) {
  const state = useSyncExternalStore(
    subscribeToSyncState,
    getSyncState,
    getSyncState
  );

  const [requesting, setRequesting] =
    useState(false);

  const requestingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function initializeStatus() {
      try {
        await refreshSyncState();
      } catch (error) {
        if (!cancelled) {
          console.warn(
            '[sync-status] Failed to refresh state:',
            error
          );
        }
      }
    }

    void initializeStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const isSyncing =
    state.status === 'syncing' || requesting;

  const handlePress = useCallback(async () => {
    if (
      requestingRef.current ||
      state.status === 'syncing'
    ) {
      return;
    }

    requestingRef.current = true;
    setRequesting(true);

    try {
      await requestSync();
    } catch (error) {
      console.warn(
        '[sync-status] Manual sync failed:',
        error
      );
    } finally {
      requestingRef.current = false;
      setRequesting(false);
    }
  }, [state.status]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel(
        state,
        isSyncing
      )}
      accessibilityHint={
        isSyncing
          ? 'Synchronization is in progress'
          : 'Double tap to request synchronization'
      }
      accessibilityState={{
        disabled: isSyncing,
        busy: isSyncing,
      }}
      disabled={isSyncing}
      onPress={() => {
        void handlePress();
      }}
      className={`
        min-h-[40px]
        flex-row
        items-center
        justify-center
        rounded-full
        bg-surface
        px-4
        active:opacity-60
        ${className}
      `}
    >
      {isSyncing ? (
        <ActivityIndicator
          size="small"
          color="#D99A16"
          style={{
            marginRight: 8,
          }}
        />
      ) : (
        <View
          className={`
            mr-2
            h-2.5
            w-2.5
            rounded-full
            ${getDotClassName(state.status)}
          `}
        />
      )}

      <AppText
        className={`
          font-spline-semibold
          text-[15px]
          leading-[20px]
          ${getTextClassName(
            isSyncing ? 'syncing' : state.status
          )}
        `}
      >
        {getLabel(state, isSyncing)}
      </AppText>
    </Pressable>
  );
}

function getLabel(
  state: SyncState,
  isSyncing: boolean
): string {
  const pendingCount = Math.max(
    0,
    state.pendingCount
  );

  if (isSyncing) {
    return pendingCount > 0
      ? `Syncing · ${pendingCount}`
      : 'Syncing';
  }

  if (state.status === 'error') {
    return pendingCount > 0
      ? `Sync issue · ${pendingCount}`
      : 'Sync issue';
  }

  if (pendingCount > 0) {
    return `${pendingCount} waiting`;
  }

  if (state.status === 'synced') {
    return 'Synced';
  }

  return 'Sync';
}

function getAccessibilityLabel(
  state: SyncState,
  isSyncing: boolean
): string {
  const pendingCount = Math.max(
    0,
    state.pendingCount
  );

  if (isSyncing) {
    return pendingCount > 0
      ? `Sync in progress. ${pendingCount} changes pending`
      : 'Sync in progress';
  }

  if (state.status === 'error') {
    return pendingCount > 0
      ? `Sync issue. ${pendingCount} changes waiting. Tap to retry`
      : 'Sync issue. Tap to retry';
  }

  if (pendingCount > 0) {
    return `${pendingCount} changes waiting to sync. Tap to sync now`;
  }

  if (state.status === 'synced') {
    return 'All changes synced. Tap to sync again';
  }

  return 'Sync now';
}

function getDotClassName(
  status: SyncStatus
): string {
  switch (status) {
    case 'synced':
      return 'bg-[#168A45]';

    case 'syncing':
      return 'bg-[#D99A16]';

    case 'error':
      return 'bg-udhaar';

    default:
      return 'bg-muted';
  }
}

function getTextClassName(
  status: SyncStatus
): string {
  switch (status) {
    case 'synced':
      return 'text-[#168A45]';

    case 'syncing':
      return 'text-muted';

    case 'error':
      return 'text-udhaar';

    default:
      return 'text-muted';
  }
}
