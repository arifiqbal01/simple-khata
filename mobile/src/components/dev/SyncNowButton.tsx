import { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';

import { requestSync } from '@/sync/sync-coordinator';

export function SyncNowButton() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(
    null
  );

  async function handleSync() {
    if (syncing) {
      return;
    }

    setSyncing(true);
    setStatus('Syncing...');

    try {
  const result = await requestSync();

  console.log('[sync] complete', result);

  const message =
    `Pushed: ${result.push.pushed}\n` +
    `Remaining: ${result.push.remaining}\n` +
    `Pulled: ${result.pull.pulled}\n` +
    `Cursor: ${result.pull.cursor}`;

  setStatus(message);

  Alert.alert(
    'Sync complete',
    message
  );
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error('[sync] failed', error);

  setStatus(`Failed: ${message}`);

  Alert.alert(
    'Sync failed',
    message
  );
} finally {
  setSyncing(false);
}

  return (
    <View className="gap-3">
      <Pressable
        disabled={syncing}
        onPress={handleSync}
        className="rounded-xl bg-black px-4 py-3"
      >
        <Text className="text-center font-semibold text-white">
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Text>
      </Pressable>

      {status ? (
        <Text className="text-sm text-neutral-600">
          {status}
        </Text>
      ) : null}
    </View>
  );
}