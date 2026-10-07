import { useEffect, useRef } from 'react';
import {
  AppState,
  type AppStateStatus,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { requestSync } from '@/services/sync/sync-coordinator';

type SyncTrigger =
  | 'startup'
  | 'foreground'
  | 'network-reconnect';

export default function SyncLifecycle() {
  const appState = useRef<AppStateStatus>(
    AppState.currentState
  );

  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    void runSync('startup');

    /*
     * Sync whenever the app returns to the foreground.
     */
    const appStateSubscription =
      AppState.addEventListener(
        'change',
        (nextState) => {
          const previousState = appState.current;

          appState.current = nextState;

          const becameActive =
            previousState !== 'active' &&
            nextState === 'active';

          if (becameActive) {
            void runSync('foreground');
          }
        }
      );

    /*
     * Sync when network connectivity changes
     * from offline -> online.
     *
     * We deliberately do not sync on the initial
     * NetInfo callback because startup already
     * requests a sync.
     */
    const netInfoUnsubscribe =
      NetInfo.addEventListener((state) => {
        const isConnected =
          state.isConnected === true &&
          state.isInternetReachable !== false;

        const reconnected =
          wasConnected.current === false &&
          isConnected;

        wasConnected.current = isConnected;

        if (reconnected) {
          void runSync('network-reconnect');
        }
      });

    return () => {
      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, []);

  return null;
}

async function runSync(
  trigger: SyncTrigger
): Promise<void> {
  try {
    console.log(`[sync-lifecycle] ${trigger}`);

    const result = await requestSync();

    console.log(
      `[sync-lifecycle] ${trigger} complete`,
      result
    );
  } catch (error) {
    console.warn(
      `[sync-lifecycle] ${trigger} failed`,
      error
    );
  }
}