
import { useEffect, useRef } from 'react';

import {
  AppState,
  type AppStateStatus,
} from 'react-native';

import NetInfo from '@react-native-community/netinfo';

import {
  requestSync,
} from '@/services/sync/sync-coordinator';

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
    let mounted = true;

    /*
     * Startup sync.
     *
     * The coordinator prevents overlapping
     * sync cycles with other app services.
     */
    void runSync('startup');

    /*
     * Sync when the app returns to foreground.
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

          if (becameActive && mounted) {
            void runSync('foreground');
          }
        }
      );

    /*
     * Sync on offline -> online transitions.
     *
     * Do not sync on the first NetInfo event,
     * because startup already triggers sync.
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

        if (
          reconnected &&
          mounted &&
          appState.current === 'active'
        ) {
          void runSync('network-reconnect');
        }
      });

    return () => {
      mounted = false;

      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, []);

  return null;
}

/**
 * Request synchronization only when
 * the device has a usable network connection.
 *
 * Network status is advisory:
 * the backend request can still fail.
 */
async function runSync(
  trigger: SyncTrigger
): Promise<void> {
  try {
    const network = await NetInfo.fetch();

    const isConnected =
      network.isConnected === true &&
      network.isInternetReachable !== false;

    if (!isConnected) {
      console.log(
        `[sync-lifecycle] ${trigger} skipped: offline`
      );

      return;
    }

    console.log(
      `[sync-lifecycle] ${trigger} starting`
    );

    const result = await requestSync();

    console.log(
      `[sync-lifecycle] ${trigger} completed`,
      {
        pushed: result.push.pushed,
        remaining: result.push.remaining,
        pulled: result.pull.pulled,
      }
    );
  } catch (error) {
    console.warn(
      `[sync-lifecycle] ${trigger} failed`,
      error
    );
  }
}