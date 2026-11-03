
import React, { useCallback, useMemo } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { AppText, Screen } from '@/components/ui';
import { useSyncDiagnostics } from '@/hooks/sync/useSyncDiagnostics';

function formatDate(value: string | null): string {
  if (!value) return 'Never';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

export default function SyncDiagnosticsScreen() {
  const {
    status,
    pendingCount,
    lastError,
    lastSyncedAt,
    operations,
    loading,
    refreshing,
    retrying,
    diagnosticsError,
    refresh,
    retrySync,
  } = useSyncDiagnostics();

  const failedOperations = useMemo(
    () => operations.filter(item => item.lastError),
    [operations]
  );

  const copyLogs = useCallback(async () => {
    const report = [
      'Simple Khata - Sync Diagnostics',
      `Status: ${status}`,
      `Pending operations: ${pendingCount}`,
      `Last successful sync: ${lastSyncedAt ?? 'Never'}`,
      `Last error: ${lastError ?? 'None'}`,
      '',
      ...operations.map(item => [
        `Operation: ${item.operationType}`,
        `ID: ${item.id}`,
        `Attempts: ${item.attemptCount}`,
        `Created: ${item.createdAt}`,
        `Last attempt: ${item.lastAttemptAt ?? 'Never'}`,
        `Next attempt: ${item.nextAttemptAt ?? 'Not scheduled'}`,
        `Error: ${item.lastError ?? 'None'}`,
        '',
      ].join('\n')),
    ].join('\n');

    await Clipboard.setStringAsync(report);
  }, [
    status,
    pendingCount,
    lastSyncedAt,
    lastError,
    operations,
  ]);

  return (
    <Screen className="bg-background">
      <View className="flex-row items-center justify-between px-4 py-4">
        <Pressable
          onPress={() => router.back()}
          className="rounded-control bg-surface px-4 py-2"
        >
          <AppText>Back</AppText>
        </Pressable>

        <AppText className="font-spline-semibold text-[18px]">
          Sync Diagnostics
        </AppText>

        <View className="w-14" />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
        }}
      >
        <View className="mb-4 rounded-control bg-surface p-4">
          <AppText className="mb-3 font-spline-semibold text-[16px]">
            Synchronization
          </AppText>

          <AppText>Status: {status}</AppText>
          <AppText>Pending operations: {pendingCount}</AppText>
          <AppText>
            Last successful sync: {formatDate(lastSyncedAt)}
          </AppText>

          {lastError ? (
            <AppText className="mt-3 text-udhaar">
              {lastError}
            </AppText>
          ) : null}
        </View>

        {diagnosticsError ? (
          <View className="mb-4 rounded-control bg-udhaar-soft p-4">
            <AppText className="text-udhaar">
              Diagnostics error: {diagnosticsError}
            </AppText>
          </View>
        ) : null}

        <View className="mb-5 flex-row gap-2">
          <Pressable
            onPress={() => void refresh()}
            disabled={refreshing}
            className="flex-1 items-center rounded-control bg-surface p-3"
          >
            <AppText>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => void retrySync()}
            disabled={retrying || status === 'syncing'}
            className="flex-1 items-center rounded-control bg-surface p-3"
          >
            <AppText>
              {retrying ? 'Syncing...' : 'Retry Sync'}
            </AppText>
          </Pressable>

          <Pressable
            onPress={() => void copyLogs()}
            className="flex-1 items-center rounded-control bg-surface p-3"
          >
            <AppText>Copy Logs</AppText>
          </Pressable>
        </View>

        <AppText className="mb-3 font-spline-semibold text-[16px]">
          Pending operations ({operations.length} shown)
        </AppText>

        {loading ? (
          <ActivityIndicator size="large" />
        ) : operations.length === 0 ? (
          <View className="rounded-control bg-surface p-4">
            <AppText>No pending operations.</AppText>
          </View>
        ) : (
          operations.map(item => (
            <View
              key={item.id}
              className="mb-3 rounded-control bg-surface p-4"
            >
              <AppText className="font-spline-semibold">
                {item.operationType}
              </AppText>

              <AppText className="mt-1 text-[12px] text-muted">
                ID: {item.id}
              </AppText>

              <AppText className="mt-2">
                Attempts: {item.attemptCount}
              </AppText>

              <AppText className="text-[12px] text-muted">
                Created: {formatDate(item.createdAt)}
              </AppText>

              <AppText className="text-[12px] text-muted">
                Last attempt: {formatDate(item.lastAttemptAt)}
              </AppText>

              <AppText className="text-[12px] text-muted">
                Next attempt: {formatDate(item.nextAttemptAt)}
              </AppText>

              {item.lastError ? (
                <View className="mt-3 rounded-control bg-udhaar-soft p-3">
                  <AppText className="text-udhaar">
                    {item.lastError}
                  </AppText>
                </View>
              ) : (
                <AppText className="mt-2 text-[12px] text-muted">
                  No recorded error
                </AppText>
              )}
            </View>
          ))
        )}

        {!loading && failedOperations.length > 0 ? (
          <AppText className="mt-2 text-[12px] text-muted">
            {failedOperations.length} displayed operations
            have recorded errors.
          </AppText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
