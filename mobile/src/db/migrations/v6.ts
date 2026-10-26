
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * v6: Migrate the local customer ledger to the Party model.
 *
 * Preconditions:
 * - Database is at user_version 5.
 * - No concurrent SQLite writers or active sync are running.
 * - Party-aware repositories and sync handlers are ready.
 *
 * The migration runs in a transaction to protect existing data.
 * Web uses withTransactionAsync because Expo SQLite does not
 * support withExclusiveTransactionAsync on web.
 */
export async function migrateToVersion6(
  db: SQLiteDatabase
): Promise<void> {
  const version = await db.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version');

  if (version?.user_version !== 5) {
    throw new Error(
      'Migration v6 requires SQLite schema version 5'
    );
  }

  // Foreign keys must be disabled before beginning the transaction.
  // Restore the original setting afterward, even if migration fails.
  const foreignKeysResult = await db.getFirstAsync<{
    foreign_keys: number;
  }>('PRAGMA foreign_keys');

  const foreignKeysWereEnabled =
    foreignKeysResult?.foreign_keys === 1;

  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    const executeMigration = async (
      tx: SQLiteDatabase
    ): Promise<void> => {
      await tx.execAsync(`
        CREATE TABLE parties (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'SUPPLIER')),
          name TEXT NOT NULL,
          phone TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by_device_id TEXT,
          FOREIGN KEY (shop_id) REFERENCES shops(id),
          FOREIGN KEY (deleted_by_device_id) REFERENCES devices(id),
          UNIQUE (shop_id, phone)
        );

        INSERT INTO parties (
          id, shop_id, type, name, phone, created_at, updated_at
        )
        SELECT
          id, shop_id, 'CUSTOMER', name, phone, created_at, updated_at
        FROM customers;

        CREATE INDEX idx_parties_shop_type_active
          ON parties(shop_id, type, name COLLATE NOCASE)
          WHERE deleted_at IS NULL;

        CREATE TABLE ledger_entries_v6 (
          id TEXT PRIMARY KEY NOT NULL,
          party_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (
            type IN ('UDHAAR', 'SUPPLY', 'PAYMENT')
          ),
          amount INTEGER NOT NULL CHECK (amount > 0),
          note TEXT,
          occurred_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          deleted_at TEXT,
          deleted_by_device_id TEXT,
          FOREIGN KEY (party_id) REFERENCES parties(id),
          FOREIGN KEY (device_id) REFERENCES devices(id),
          FOREIGN KEY (deleted_by_device_id) REFERENCES devices(id)
        );

        INSERT INTO ledger_entries_v6 (
          id,
          party_id,
          device_id,
          type,
          amount,
          note,
          occurred_at,
          created_at,
          deleted_at,
          deleted_by_device_id
        )
        SELECT
          id,
          customer_id,
          device_id,
          type,
          amount,
          note,
          occurred_at,
          created_at,
          deleted_at,
          deleted_by_device_id
        FROM ledger_entries;

        CREATE TABLE entry_items_v6 (
          id TEXT PRIMARY KEY NOT NULL,
          ledger_entry_id TEXT NOT NULL,
          item_id TEXT,
          name TEXT NOT NULL,
          amount INTEGER,
          quantity TEXT,
          unit TEXT,
          unit_price INTEGER,
          FOREIGN KEY (ledger_entry_id)
            REFERENCES ledger_entries_v6(id),
          FOREIGN KEY (item_id)
            REFERENCES items(id),
          CHECK (
            unit_price IS NULL OR unit_price >= 0
          )
        );

        INSERT INTO entry_items_v6 (
          id,
          ledger_entry_id,
          item_id,
          name,
          amount
        )
        SELECT
          id,
          ledger_entry_id,
          item_id,
          name,
          amount
        FROM entry_items;

        DROP TABLE entry_items;
        DROP TABLE ledger_entries;

        ALTER TABLE ledger_entries_v6
          RENAME TO ledger_entries;

        ALTER TABLE entry_items_v6
          RENAME TO entry_items;

        DROP TABLE customers;

        CREATE INDEX idx_ledger_entries_party
          ON ledger_entries(party_id);

        CREATE INDEX idx_ledger_entries_device
          ON ledger_entries(device_id);

        CREATE INDEX idx_ledger_entries_party_occurred
          ON ledger_entries(party_id, occurred_at);

        CREATE INDEX idx_ledger_entries_party_active
          ON ledger_entries(party_id, occurred_at)
          WHERE deleted_at IS NULL;

        CREATE INDEX idx_entry_items_ledger_entry
          ON entry_items(ledger_entry_id);

        CREATE INDEX idx_entry_items_item
          ON entry_items(item_id);

        ALTER TABLE items
          ADD COLUMN default_unit TEXT;

        ALTER TABLE items
          ADD COLUMN default_selling_price INTEGER
          CHECK (
            default_selling_price IS NULL
            OR default_selling_price >= 0
          );

        ALTER TABLE items
          ADD COLUMN deleted_at TEXT;

        ALTER TABLE items
          ADD COLUMN deleted_by_device_id TEXT
          REFERENCES devices(id);

        CREATE INDEX idx_items_shop_active
          ON items(shop_id, name COLLATE NOCASE)
          WHERE deleted_at IS NULL;

        CREATE TABLE supplier_items (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          supplier_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          unit TEXT NOT NULL,
          unit_price INTEGER NOT NULL
            CHECK (unit_price >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (shop_id)
            REFERENCES shops(id),
          FOREIGN KEY (supplier_id)
            REFERENCES parties(id),
          FOREIGN KEY (item_id)
            REFERENCES items(id),
          UNIQUE (supplier_id, item_id)
        );

        CREATE INDEX idx_supplier_items_shop
          ON supplier_items(shop_id);

        CREATE INDEX idx_supplier_items_supplier
          ON supplier_items(supplier_id);

        CREATE INDEX idx_supplier_items_item
          ON supplier_items(item_id);

        CREATE TABLE sync_outbox_v6 (
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
              'LEDGER_ENTRY_CREATE',
              'LEDGER_ENTRY_DELETE'
            )
          ),
          entity_type TEXT NOT NULL CHECK (
            entity_type IN (
              'CUSTOMER',
              'PARTY',
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

        INSERT INTO sync_outbox_v6 (
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

        DROP TABLE sync_outbox;

        ALTER TABLE sync_outbox_v6
          RENAME TO sync_outbox;

        CREATE INDEX idx_sync_outbox_created
          ON sync_outbox(created_at);

        CREATE INDEX idx_sync_outbox_retry
          ON sync_outbox(next_attempt_at, created_at);

        CREATE INDEX idx_sync_outbox_entity
          ON sync_outbox(entity_type, entity_id);

        CREATE INDEX idx_sync_outbox_shop
          ON sync_outbox(shop_id);

        PRAGMA user_version = 6;
      `);

      // Validate foreign keys before committing.
      const fkViolations = await tx.getAllAsync<{
        table: string;
        rowid: number;
        parent: string;
        fkid: number;
      }>('PRAGMA foreign_key_check');

      if (fkViolations.length > 0) {
        throw new Error(
          `Migration v6 would violate ${fkViolations.length} foreign-key constraint(s)`
        );
      }
    };

    if (Platform.OS === 'web') {
      // Expo SQLite does not support exclusive transactions on web.
      await db.withTransactionAsync(async () => {
        await executeMigration(db);
      });
    } else {
      // Use exclusive transactions on Android and iOS.
      await db.withExclusiveTransactionAsync(async (tx) => {
        await executeMigration(tx);
      });
    }
  } finally {
    // Restore the connection's previous foreign-key setting.
    await db.execAsync(
      foreignKeysWereEnabled
        ? 'PRAGMA foreign_keys = ON;'
        : 'PRAGMA foreign_keys = OFF;'
    );
  }
}