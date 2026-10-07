import React, {
  useEffect,
  useSyncExternalStore,
} from 'react';
import {
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

import { AppText } from './AppText';

export interface SyncStatusBadgeProps {
  className?: string;
}

export function SyncStatusBadge({
  className = '',
}: SyncStatusBadgeProps) {
  const state = useSyncExternalStore(
    subscribeToSyncState,
    getSyncState,
    getSyncState
  );

  useEffect(() => {
    void refreshSyncState().catch((error) => {
      console.warn(
        '[sync-status] failed to refresh state',
        error
      );
    });
  }, []);

  function handlePress(): void {
    if (state.status === 'syncing') {
      return;
    }

    void requestSync().catch((error) => {
      console.warn(
        '[sync-status] manual sync failed',
        error
      );
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getAccessibilityLabel(state)}
      disabled={state.status === 'syncing'}
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
      <View
        className={`
          mr-2
          h-2.5
          w-2.5
          rounded-full
          ${getDotClassName(state.status)}
        `}
      />

      <AppText
        className={`
          font-spline-semibold
          text-[15px]
          leading-[20px]
          ${getTextClassName(state.status)}
        `}
      >
        {getLabel(state)}
      </AppText>
    </Pressable>
  );
}

function getLabel(
  state: ReturnType<typeof getSyncState>
): string {
  if (state.status === 'syncing') {
    return state.pendingCount > 0
      ? `Syncing · ${state.pendingCount}`
      : 'Syncing';
  }

  if (state.status === 'error') {
    return state.pendingCount > 0
      ? `Offline · ${state.pendingCount}`
      : 'Offline';
  }

  if (state.pendingCount > 0) {
    return `${state.pendingCount} waiting`;
  }

  if (state.status === 'synced') {
    return 'Synced';
  }

  return 'Sync';
}

function getAccessibilityLabel(
  state: ReturnType<typeof getSyncState>
): string {
  if (state.status === 'syncing') {
    return 'Sync in progress';
  }

  if (state.status === 'error') {
    return state.pendingCount > 0
      ? `Sync unavailable. ${state.pendingCount} changes waiting`
      : 'Sync unavailable';
  }

  if (state.pendingCount > 0) {
    return `${state.pendingCount} changes waiting to sync`;
  }

  if (state.status === 'synced') {
    return 'Synced';
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