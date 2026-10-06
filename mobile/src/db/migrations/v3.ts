import { getDatabase } from '../database';

/**
 * Migration v3
 *
 * Adds the local infrastructure required for offline-first synchronization.
 *
 * Important:
 * - Financial/domain tables remain unchanged.
 * - The outbox stores durable local mutations waiting to be pushed.
 * - sync_state stores the durable server pull cursor and sync diagnostics.
 * - Outbox rows must later be created in the SAME SQLite transaction
 *   as the corresponding local domain mutation.
 * - Remote changes applied from pull must NOT create outbox rows.
 */
export async function migrateToVersion3(): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE sync_outbox (
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
              'LEDGER_ENTRY_CREATE'
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


      CREATE INDEX idx_sync_outbox_created
      ON sync_outbox(created_at);


      CREATE INDEX idx_sync_outbox_retry
      ON sync_outbox(next_attempt_at, created_at);


      CREATE INDEX idx_sync_outbox_entity
      ON sync_outbox(entity_type, entity_id);


      CREATE INDEX idx_sync_outbox_shop
      ON sync_outbox(shop_id);


      CREATE TABLE sync_state (
        shop_id TEXT PRIMARY KEY NOT NULL,

        pull_cursor INTEGER NOT NULL DEFAULT 0
          CHECK (pull_cursor >= 0),

        last_successful_sync_at TEXT,
        last_push_at TEXT,
        last_pull_at TEXT,

        last_error TEXT,

        updated_at TEXT NOT NULL,

        FOREIGN KEY (shop_id)
          REFERENCES shops(id)
      );


      PRAGMA user_version = 3;
    `);
  });
}