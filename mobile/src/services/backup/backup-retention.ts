
import * as FileSystem from 'expo-file-system/legacy';

import { BACKUP_POLICY } from './backup-policy';

export type BackupReason =
  | 'MANUAL'
  | 'SCHEDULED'
  | 'TRANSACTION_THRESHOLD'
  | 'PRE_MIGRATION'
  | 'PRE_LEGACY_REPAIR';

export interface BackupRecord {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  reason: BackupReason;
  verified: boolean;
  protected: boolean;
}

export interface RetentionResult {
  kept: BackupRecord[];
  deleted: string[];
  failed: string[];
}

const PROTECTED_REASONS: BackupReason[] = [
  'PRE_MIGRATION',
  'PRE_LEGACY_REPAIR',
];

export function isProtectedBackup(
  record: BackupRecord
): boolean {
  return (
    record.protected ||
    PROTECTED_REASONS.includes(record.reason)
  );
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function weekKey(date: Date): string {
  const utc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);

  const year = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));

  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) /
      86400000 + 1) / 7
  );

  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Pure selection function.
 *
 * Returns IDs of backups to keep.
 * Does not access or delete files.
 */
export function selectBackupsToKeep(
  records: BackupRecord[]
): Set<string> {
  const keep = new Set<string>();

  const verified = records
    .filter(
      (record) =>
        record.verified &&
        Number.isFinite(Date.parse(record.createdAt))
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) -
        Date.parse(a.createdAt)
    );

  // Never remove protected backup records.
  for (const record of records) {
    if (isProtectedBackup(record)) {
      keep.add(record.id);
    }
  }

  // Always preserve the newest verified snapshot.
  if (
    BACKUP_POLICY.preserveLastVerifiedBackup &&
    verified.length > 0
  ) {
    keep.add(verified[0].id);
  }

  const daily = new Set<string>();
  const weekly = new Set<string>();
  const monthly = new Set<string>();

  for (const record of verified) {
    const date = new Date(record.createdAt);

    const day = dayKey(date);
    const week = weekKey(date);
    const month = monthKey(date);

    if (
      daily.size < BACKUP_POLICY.retention.daily &&
      !daily.has(day)
    ) {
      daily.add(day);
      keep.add(record.id);
    }

    if (
      weekly.size < BACKUP_POLICY.retention.weekly &&
      !weekly.has(week)
    ) {
      weekly.add(week);
      keep.add(record.id);
    }

    if (
      monthly.size < BACKUP_POLICY.retention.monthly &&
      !monthly.has(month)
    ) {
      monthly.add(month);
      keep.add(record.id);
    }
  }

  return keep;
}

/**
 * Only delete records explicitly supplied by the
 * manager after verification and path validation.
 *
 * The manager must serialize this with backup jobs.
 */
export async function applyBackupRetention(
  records: BackupRecord[],
  backupDirectory: string
): Promise<RetentionResult> {
  const keepIds = selectBackupsToKeep(records);

  const kept: BackupRecord[] = [];
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const record of records) {
    if (
      keepIds.has(record.id) ||
      !record.verified ||
      isProtectedBackup(record)
    ) {
      kept.push(record);
      continue;
    }

    // Strict filename allowlist prevents path traversal.
    if (
      !/^simple-khata-[A-Za-z0-9_-]+\.db$/.test(
        record.fileName
      )
    ) {
      kept.push(record);
      failed.push(record.id);
      continue;
    }

    const uri = `${backupDirectory}${record.fileName}`;

    try {
      const info = await FileSystem.getInfoAsync(uri);

      if (info.exists && info.isDirectory) {
        throw new Error('Backup path is a directory');
      }

      if (info.exists) {
        await FileSystem.deleteAsync(uri, {
          idempotent: true,
        });
      }

      // The manager updates its metadata after this.
      deleted.push(record.id);
    } catch (error) {
      console.error('[backup] retention failed', {
        id: record.id,
        error,
      });

      kept.push(record);
      failed.push(record.id);
    }
  }

  return { kept, deleted, failed };
}
