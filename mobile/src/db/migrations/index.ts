import { getDatabase } from '../database';
import { migrateToVersion1 } from './v1';
import { migrateToVersion2 } from './v2';
import { migrateToVersion3 } from './v3';
import { migrateToVersion4 } from './v4';

const DATABASE_VERSION = 4;

let migrationPromise: Promise<void> | null = null;

export function runMigrations(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise =
      runMigrationsInternal().catch((error) => {
        migrationPromise = null;
        throw error;
      });
  }

  return migrationPromise;
}

async function runMigrationsInternal(): Promise<void> {
  const db = await getDatabase();

  const result =
    await db.getFirstAsync<{
      user_version: number;
    }>('PRAGMA user_version');

  const currentVersion =
    result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await migrateToVersion1(db);
  }

  if (currentVersion < 2) {
    await migrateToVersion2(db);
  }

  if (currentVersion < 3) {
    await migrateToVersion3(db);
  }

  if (currentVersion < 4) {
    await migrateToVersion4(db);
  }
}