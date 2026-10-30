
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

import { BACKUP_POLICY } from './backup-policy';
import { exportSqliteBackup } from './sqlite-backup';
import {
  applyBackupRetention,
  type BackupReason,
  type BackupRecord,
} from './backup-retention';

const BACKUP_FOLDER = 'backups/';
const MANIFEST_NAME = 'backup-manifest.json';

let backupQueue: Promise<void> = Promise.resolve();

function backupDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Document directory unavailable');
  }

  return FileSystem.documentDirectory + BACKUP_FOLDER;
}

function manifestUri(): string {
  return backupDirectory() + MANIFEST_NAME;
}

function fileNameFromUri(uri: string): string {
  const name = uri.split('/').pop();

  if (
    !name ||
    !/^simple-khata-[A-Za-z0-9_-]+\.db$/.test(name)
  ) {
    throw new Error('Unexpected backup filename');
  }

  return name;
}

function serializeBackupJob<T>(
  task: () => Promise<T>
): Promise<T> {
  const operation = backupQueue.then(task);

  backupQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}

function isBackupRecord(
  value: unknown
): value is BackupRecord {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'string' &&
    typeof item.fileName === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.sizeBytes === 'number' &&
    typeof item.reason === 'string' &&
    typeof item.verified === 'boolean' &&
    typeof item.protected === 'boolean'
  );
}

async function readManifest(): Promise<BackupRecord[]> {
  const uri = manifestUri();
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists) {
    return [];
  }

  // Corrupt metadata is an error, not an empty history.
  const content = await FileSystem.readAsStringAsync(uri);
  const parsed: unknown = JSON.parse(content);

  if (
    !Array.isArray(parsed) ||
    !parsed.every(isBackupRecord)
  ) {
    throw new Error('Invalid backup manifest');
  }

  return parsed;
}

async function writeManifest(
  records: BackupRecord[]
): Promise<void> {
  const directory = backupDirectory();

  await FileSystem.makeDirectoryAsync(directory, {
    intermediates: true,
  });

  const destination = manifestUri();
  const temporary = destination + '.tmp';

  await FileSystem.writeAsStringAsync(
    temporary,
    JSON.stringify(records, null, 2)
  );

  // Preserve the existing manifest until the
  // replacement is ready. Filesystem replacement
  // semantics must be tested on the target Android OS.
  const oldInfo =
    await FileSystem.getInfoAsync(destination);

  if (oldInfo.exists) {
    const previous = destination + '.previous';

    await FileSystem.copyAsync({
      from: destination,
      to: previous,
    });
  }

  await FileSystem.moveAsync({
    from: temporary,
    to: destination,
  });
}

/**
 * Opens the copied SQLite database separately.
 *
 * The directory argument is a filesystem path,
 * not a file:// URI.
 */
async function verifySqliteBackup(
  backupUri: string
): Promise<void> {
  const filename = fileNameFromUri(backupUri);

  const directoryUri = backupUri.slice(
    0,
    backupUri.length - filename.length
  );

  const directoryPath = decodeURIComponent(
    directoryUri.replace(/^file:\/\//, '')
  );

  const backupDb = await SQLite.openDatabaseAsync(
    filename,
    { useNewConnection: true },
    directoryPath
  );

  try {
    const rows = await backupDb.getAllAsync<{
      integrity_check: string;
    }>('PRAGMA integrity_check');

    if (
      rows.length !== 1 ||
      rows[0].integrity_check !== 'ok'
    ) {
      throw new Error(
        'Backup failed SQLite integrity check'
      );
    }

    // Check essential application tables.
    const requiredTables = [
      'ledger_entries',
      'entry_items',
      'sync_outbox',
    ];

    const tables = await backupDb.getAllAsync<{
      name: string;
    }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'`
    );

    const names = new Set(
      tables.map((table) => table.name)
    );

    for (const table of requiredTables) {
      if (!names.has(table)) {
        throw new Error(
          `Backup missing required table: ${table}`
        );
      }
    }
  } finally {
    await backupDb.closeAsync();
  }
}

async function createBackupInternal(
  reason: BackupReason
): Promise<BackupRecord> {
  const existing = await readManifest();

  // exportSqliteBackup already uses the shared
  // SQLite operation queue.
  const uri = await exportSqliteBackup();

  const info = await FileSystem.getInfoAsync(uri);

  if (
    !info.exists ||
    info.isDirectory ||
    info.size <= 0
  ) {
    throw new Error('Backup file missing or empty');
  }

  await verifySqliteBackup(uri);

  const createdAt = new Date().toISOString();

  const record: BackupRecord = {
    id: fileNameFromUri(uri),
    fileName: fileNameFromUri(uri),
    createdAt,
    sizeBytes: info.size,
    reason,
    verified: true,
    protected:
      reason === 'PRE_MIGRATION' ||
      reason === 'PRE_LEGACY_REPAIR',
  };

  const updated = [...existing, record];

  // Save new backup metadata before any cleanup.
  await writeManifest(updated);

  console.log('[backup] verified', {
    id: record.id,
    reason: record.reason,
    sizeBytes: record.sizeBytes,
  });

  // Cleanup failure must not invalidate a good backup.
  try {
    const result = await applyBackupRetention(
      updated,
      backupDirectory()
    );

    await writeManifest(result.kept);
  } catch (error) {
    console.error('[backup] retention error', error);
  }

  return record;
}

export function createBackup(
  reason: BackupReason = 'MANUAL'
): Promise<BackupRecord> {
  return serializeBackupJob(() =>
    createBackupInternal(reason)
  );
}

export function listBackups(): Promise<BackupRecord[]> {
  return serializeBackupJob(readManifest);
}

/**
 * Call on app startup and when returning
 * to the foreground.
 *
 * Not a background timer.
 */
export function runScheduledBackupIfDue():
  Promise<BackupRecord | null> {
  return serializeBackupJob(async () => {
    if (!BACKUP_POLICY.enabled) {
      return null;
    }

    const records = await readManifest();

    const latest = records
      .filter(
        (record) =>
          record.verified &&
          Number.isFinite(Date.parse(record.createdAt))
      )
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) -
          Date.parse(a.createdAt)
      )[0];

    const now = Date.now();

    if (
      latest &&
      now - Date.parse(latest.createdAt) <
        BACKUP_POLICY.automaticIntervalMs
    ) {
      return null;
    }

    return createBackupInternal('SCHEDULED');
  });
}
