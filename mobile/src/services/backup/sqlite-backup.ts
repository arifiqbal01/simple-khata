
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  runExclusiveDatabaseOperation,
} from '@/db/write-transaction';

const BACKUP_DIRECTORY_NAME = 'backups';

function getBackupDirectory(): string {
  const root = FileSystem.documentDirectory;

  if (!root) {
    throw new Error(
      'Application document directory is unavailable'
    );
  }

  return `${root}${BACKUP_DIRECTORY_NAME}/`;
}

function createBackupFileName(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  return `simple-khata-${timestamp}.db`;
}

function sqlitePathFromFileUri(uri: string): string {
  if (!uri.startsWith('file://')) {
    throw new Error('Invalid backup file URI');
  }

  return decodeURIComponent(
    uri.substring('file://'.length)
  );
}

function quoteSqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Create a complete SQLite backup.
 *
 * Does not modify or delete the live database.
 */
export async function exportSqliteBackup(): Promise<string> {
  return runExclusiveDatabaseOperation(async (db) => {
    const directory = getBackupDirectory();

    await FileSystem.makeDirectoryAsync(directory, {
      intermediates: true,
    });

    const backupUri =
      directory + createBackupFileName();

    const backupPath =
      sqlitePathFromFileUri(backupUri);

    /*
     * VACUUM INTO must run outside a transaction.
     * It creates a consistent snapshot, including
     * committed WAL transactions.
     */
    await db.execAsync(
      `VACUUM INTO ${quoteSqliteString(backupPath)}`
    );

    const info =
      await FileSystem.getInfoAsync(backupUri);

    if (
      !info.exists ||
      info.isDirectory ||
      info.size <= 0
    ) {
      throw new Error(
        'SQLite backup file was not created correctly'
      );
    }

    console.log('[backup] created', {
      uri: backupUri,
      size: info.size,
    });

    return backupUri;
  });
}

/**
 * Create and share a backup file.
 *
 * The user must save it outside application storage.
 */
export async function shareSqliteBackup(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      'File sharing is unavailable on this device'
    );
  }

  const backupUri = await exportSqliteBackup();

  await Sharing.shareAsync(backupUri, {
    mimeType: 'application/x-sqlite3',
    dialogTitle: 'Export Simple Khata backup',
  });
}
