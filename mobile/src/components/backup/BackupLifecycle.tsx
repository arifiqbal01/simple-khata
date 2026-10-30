
import { useEffect } from 'react';

import {
  AppState,
  Platform,
  type AppStateStatus,
} from 'react-native';

import {
  runScheduledBackupIfDue,
} from '@/services/backup/backup-manager';

export function BackupLifecycle() {
  useEffect(() => {
    // Native SQLite file backup is supported
    // only on Android and iOS.
    if (Platform.OS === 'web') {
      console.log(
        '[backup] skipped: native SQLite backup ' +
        'is unavailable on web'
      );

      return;
    }

    let active = true;

    const checkBackup = async () => {
      try {
        const backup =
          await runScheduledBackupIfDue();

        if (active && backup) {
          console.log(
            '[backup] automatic backup completed',
            {
              fileName: backup.fileName,
              sizeBytes: backup.sizeBytes,
              verified: backup.verified,
            }
          );
        }
      } catch (error) {
        console.error(
          '[backup] automatic backup failed',
          error
        );
      }
    };

    // Check when the component mounts.
    void checkBackup();

    // Check again when the app returns
    // from background to foreground.
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void checkBackup();
        }
      }
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return null;
}
