
import { useEffect, useRef } from 'react';

import {
  AppState,
  type AppStateStatus,
} from 'react-native';

import NetInfo from '@react-native-community/netinfo';

import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import {
  requestSync,
} from '@/services/sync/sync-coordinator';

const localIdentityRepository =
  new LocalIdentityRepository();

type SyncTrigger =
  | 'startup'
  | 'foreground'
  | 'network-reconnect';

export function SyncLifecycle() {
  const appState = useRef<AppStateStatus>(
    AppState.currentState
  );

  const wasConnected = useRef<boolean | null>(null);

  const runningRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function runSync(
      trigger: SyncTrigger
    ): Promise<void> {
      if (!mounted || runningRef.current) {
        return;
      }

      runningRef.current = true;

      try {
        const identity =
          await localIdentityRepository.get();

        if (!mounted) {
          return;
        }

        if (
          !identity ||
          !identity.shopId?.trim() ||
          !identity.deviceId?.trim()
        ) {
          console.log(
            `[sync-lifecycle] ${trigger} skipped: installation not initialized`
          );

          return;
        }

        const network = await NetInfo.fetch();

        if (!mounted) {
          return;
        }

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

        if (!mounted) {
          return;
        }

        console.log(
          `[sync-lifecycle] ${trigger} completed`,
          {
            pushed: result.push.pushed,
            remaining: result.push.remaining,
            pulled: result.pull.pulled,
          }
        );
      } catch (error) {
        if (mounted) {
          console.warn(
            `[sync-lifecycle] ${trigger} failed`,
            error
          );
        }
      } finally {
        runningRef.current = false;
      }
    }

    // Startup synchronization.
    void runSync('startup');

    // Synchronize when the app returns to foreground.
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

    // Synchronize when connectivity is restored.
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

// Support both named and default imports.
export default SyncLifecycle;
