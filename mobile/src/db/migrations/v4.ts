import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateToVersion4(
  db: SQLiteDatabase
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE local_identity (
        singleton INTEGER PRIMARY KEY NOT NULL
          CHECK (singleton = 1),

        shop_id TEXT NOT NULL,
        device_id TEXT NOT NULL,

        created_at TEXT NOT NULL,

        FOREIGN KEY (shop_id)
          REFERENCES shops(id),

        FOREIGN KEY (device_id)
          REFERENCES devices(id),

        UNIQUE (shop_id, device_id)
      );

      CREATE INDEX idx_local_identity_shop
      ON local_identity(shop_id);

      CREATE INDEX idx_local_identity_device
      ON local_identity(device_id);

      PRAGMA user_version = 4;
    `);
  });
}