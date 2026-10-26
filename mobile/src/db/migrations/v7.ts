
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * v7: Add supplier-item operations to sync_outbox.
 *
 * Preserves existing pending operations, including their
 * retry metadata and insertion order.
 *
 * Preconditions:
 * - SQLite schema version is 6.
 * - Migrations run before application writes or sync.
 */
export async function migrateToVersion7(
  db: SQLiteDatabase
): Promise<void> {
  const version = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version');

  if (version?.user_version !== 6) {
    throw new Error(
      'Migration v7 requires SQLite schema version 6'
    );
  }

  console.log('[migration-v7] Starting');

  const foreignKeysResult = await db.getFirstAsync<{
    foreign_keys: number;
  }>('PRAGMA foreign_keys');

  const foreignKeysWereEnabled =
    foreignKeysResult?.foreign_keys === 1;

  // Must be changed outside the transaction.
  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    const executeMigration = async (
      tx: SQLiteDatabase
    ): Promise<void> => {
      const before = await tx.getFirstAsync<{
        count: number;
      }>(
        'SELECT COUNT(*) AS count FROM sync_outbox'
      );

      const originalCount = before?.count ?? 0;

      console.log(
        '[migration-v7] Existing outbox records:',
        originalCount
      );

      await tx.execAsync(`
        CREATE TABLE sync_outbox_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          device_id TEXT NOT NULL,

          operation_type TEXT NOT NULL CHECK (
            operation_type IN (
              'CUSTOMER_CREATE',
              'CUSTOMER_UPDATE',
              'PARTY_CREATE',
              'PARTY_UPDATE',
              'PARTY_DELETE',
              'ITEM_CREATE',
              'ITEM_UPDATE',
              'ITEM_DELETE',
              'SUPPLIER_ITEM_CREATE',
              'SUPPLIER_ITEM_UPDATE',
              'SUPPLIER_ITEM_DELETE',
              'LEDGER_ENTRY_CREATE',
              'LEDGER_ENTRY_DELETE'
            )
          ),

          entity_type TEXT NOT NULL CHECK (
            entity_type IN (
              'CUSTOMER',
              'PARTY',
              'ITEM',
              'SUPPLIER_ITEM',
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

        INSERT INTO sync_outbox_v7 (
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
        FROM sync_outbox
        ORDER BY rowid;
      `);

      const copied = await tx.getFirstAsync<{
        count: number;
      }>(
        'SELECT COUNT(*) AS count FROM sync_outbox_v7'
      );

      if ((copied?.count ?? 0) !== originalCount) {
        throw new Error(
          'Migration v7 failed to preserve all outbox records'
        );
      }

      await tx.execAsync(`
        DROP TABLE sync_outbox;

        ALTER TABLE sync_outbox_v7
          RENAME TO sync_outbox;

        CREATE INDEX idx_sync_outbox_created
          ON sync_outbox(created_at);

        CREATE INDEX idx_sync_outbox_retry
          ON sync_outbox(next_attempt_at, created_at);

        CREATE INDEX idx_sync_outbox_entity
          ON sync_outbox(entity_type, entity_id);

        CREATE INDEX idx_sync_outbox_shop
          ON sync_outbox(shop_id);
      `);

      const violations = await tx.getAllAsync<{
        table: string;
        rowid: number;
        parent: string;
        fkid: number;
      }>('PRAGMA foreign_key_check');

      if (violations.length > 0) {
        throw new Error(
          `Migration v7 detected ${violations.length} foreign-key violation(s)`
        );
      }

      await tx.execAsync('PRAGMA user_version = 7;');

      console.log(
        '[migration-v7] Outbox records preserved:',
        originalCount
      );
    };

    if (Platform.OS === 'web') {
      await db.withTransactionAsync(async () => {
        await executeMigration(db);
      });
    } else {
      await db.withExclusiveTransactionAsync(
        async (tx) => {
          await executeMigration(tx);
        }
      );
    }

    console.log('[migration-v7] Completed');
  } finally {
    await db.execAsync(
      foreignKeysWereEnabled
        ? 'PRAGMA foreign_keys = ON;'
        : 'PRAGMA foreign_keys = OFF;'
    );
  }
}
