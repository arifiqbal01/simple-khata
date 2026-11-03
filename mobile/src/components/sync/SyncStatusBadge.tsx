
import React, {
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  getSyncState,
  refreshSyncState,
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

  const isSyncing = state.status === 'syncing';

  /**
   * Open Sync Diagnostics instead of starting
   * synchronization directly from the badge.
   *
   * Navigation remains available while syncing.
   */
  const handlePress = useCallback(() => {
    router.push('/sync-diagnostics');
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel(
        state,
        isSyncing
      )}
      accessibilityHint="Double tap to open sync diagnostics"
      accessibilityState={{
        busy: isSyncing,
      }}
      onPress={handlePress}
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
          ${getTextClassName(state.status)}
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
      ? `Sync in progress. ${pendingCount} changes pending. Open sync diagnostics`
      : 'Sync in progress. Open sync diagnostics';
  }

  if (state.status === 'error') {
    return pendingCount > 0
      ? `Sync issue. ${pendingCount} changes waiting. Open sync diagnostics`
      : 'Sync issue. Open sync diagnostics';
  }

  if (pendingCount > 0) {
    return `${pendingCount} changes waiting to sync. Open sync diagnostics`;
  }

  if (state.status === 'synced') {
    return 'All changes synced. Open sync diagnostics';
  }

  return 'Open sync diagnostics';
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
