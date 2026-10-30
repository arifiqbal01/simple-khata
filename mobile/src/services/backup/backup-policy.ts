
export const BACKUP_POLICY = {
  enabled: true,

  automaticIntervalMs:
    24 * 60 * 60 * 1000,

  transactionsBetweenBackups: 20,

  minimumIntervalMs:
    60 * 60 * 1000,

  retention: {
    daily: 7,
    weekly: 4,
    monthly: 3,
  },

  requireBeforeMigration: true,
  requireBeforeLegacyRepair: true,

  preserveLastVerifiedBackup: true,
} as const;

export function isScheduledBackupDue(
  lastBackupAt: string | null,
  now = new Date()
): boolean {
  if (!BACKUP_POLICY.enabled) {
    return false;
  }

  if (!lastBackupAt) {
    return true;
  }

  const previous = Date.parse(lastBackupAt);

  if (!Number.isFinite(previous)) {
    return true;
  }

  return (
    now.getTime() - previous >=
    BACKUP_POLICY.automaticIntervalMs
  );
}

export function isTransactionBackupDue(
  transactionsSinceBackup: number,
  lastBackupAt: string | null,
  now = new Date()
): boolean {
  if (!BACKUP_POLICY.enabled) {
    return false;
  }

  if (
    transactionsSinceBackup <
    BACKUP_POLICY.transactionsBetweenBackups
  ) {
    return false;
  }

  if (!lastBackupAt) {
    return true;
  }

  const previous = Date.parse(lastBackupAt);

  return (
    !Number.isFinite(previous) ||
    now.getTime() - previous >=
      BACKUP_POLICY.minimumIntervalMs
  );
}
