import { getDatabase } from '../database';

import { migrateToVersion1 } from './v1';
import { migrateToVersion2 } from './v2';
import { migrateToVersion3 } from './v3';

const DATABASE_VERSION = 3;

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version');

  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await migrateToVersion1();
  }

  if (currentVersion < 2) {
    await migrateToVersion2();
  }

  if (currentVersion < 3) {
    await migrateToVersion3();
  }
}