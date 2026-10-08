import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateToVersion5(
  db: SQLiteDatabase
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Add tombstone fields to existing ledger entries.
    await db.execAsync(`
      ALTER TABLE ledger_entries
        ADD COLUMN deleted_at TEXT;

      ALTER TABLE ledger_entries
        ADD COLUMN deleted_by_device_id TEXT;

      CREATE INDEX idx_ledger_entries_customer_active
        ON ledger_entries(customer_id, occurred_at)
        WHERE deleted_at IS NULL;
    `);

    // SQLite cannot directly modify an existing CHECK constraint.
    // Rebuild the outbox table while preserving its records.
    await db.execAsync(`
      CREATE TABLE sync_outbox_v5 (
        id TEXT PRIMARY KEY NOT NULL,

        shop_id TEXT NOT NULL,
        device_id TEXT NOT NULL,

        operation_type TEXT NOT NULL
          CHECK (
            operation_type IN (
              'CUSTOMER_CREATE',
              'CUSTOMER_UPDATE',
              'ITEM_CREATE',
              'ITEM_UPDATE',
              'LEDGER_ENTRY_CREATE',
              'LEDGER_ENTRY_DELETE'
            )
          ),

        entity_type TEXT NOT NULL
          CHECK (
            entity_type IN (
              'CUSTOMER',
              'ITEM',
              'LEDGER_ENTRY'
            )
          ),

        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,

        attempt_count INTEGER NOT NULL DEFAULT 0
          CHECK (attempt_count >= 0),

        next_attempt_at TEXT,
        last_attempt_at TEXT,
        last_error TEXT,

        created_at TEXT NOT NULL,

        FOREIGN KEY (shop_id)
          REFERENCES shops(id),

        FOREIGN KEY (device_id)
          REFERENCES devices(id)
      );

      INSERT INTO sync_outbox_v5 (
        id,
        shop_id,
        device_id,
        operation_type,
        entity_type,
        entity_id,
        payload,
        attempt_count,
        next_attempt_at,
        last_attempt_at,
        last_error,
        created_at
      )
      SELECT
        id,
        shop_id,
        device_id,
        operation_type,
        entity_type,
        entity_id,
        payload,
        attempt_count,
        next_attempt_at,
        last_attempt_at,
        last_error,
        created_at
      FROM sync_outbox;

      DROP TABLE sync_outbox;

      ALTER TABLE sync_outbox_v5
        RENAME TO sync_outbox;

      CREATE INDEX idx_sync_outbox_created
        ON sync_outbox(created_at);

      CREATE INDEX idx_sync_outbox_retry
        ON sync_outbox(next_attempt_at, created_at);

      CREATE INDEX idx_sync_outbox_entity
        ON sync_outbox(entity_type, entity_id);

      CREATE INDEX idx_sync_outbox_shop
        ON sync_outbox(shop_id);

      PRAGMA user_version = 5;
    `);
  });
}