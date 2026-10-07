import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration v1
 *
 * Creates the initial local database schema.
 *
 * The database connection is provided by the migration runner
 * so migrations do not open additional SQLite connections.
 */
export async function migrateToVersion1(
  db: SQLiteDatabase
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY NOT NULL,
        shop_id TEXT NOT NULL,
        name TEXT,
        last_sync_at TEXT,
        created_at TEXT NOT NULL,

        FOREIGN KEY (shop_id)
          REFERENCES shops(id)
      );

      CREATE INDEX IF NOT EXISTS
        idx_devices_shop
      ON devices(shop_id);


      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY (shop_id)
          REFERENCES shops(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS
        idx_customers_shop_phone
      ON customers(shop_id, phone);

      CREATE INDEX IF NOT EXISTS
        idx_customers_shop
      ON customers(shop_id);


      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,

        FOREIGN KEY (shop_id)
          REFERENCES shops(id)
      );

      CREATE INDEX IF NOT EXISTS
        idx_items_shop
      ON items(shop_id);


      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL,
        device_id TEXT NOT NULL,

        type TEXT NOT NULL
          CHECK (type IN ('UDHAAR', 'PAYMENT')),

        amount INTEGER NOT NULL
          CHECK (amount > 0),

        note TEXT,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,

        FOREIGN KEY (customer_id)
          REFERENCES customers(id),

        FOREIGN KEY (device_id)
          REFERENCES devices(id)
      );

      CREATE INDEX IF NOT EXISTS
        idx_ledger_entries_customer
      ON ledger_entries(customer_id);

      CREATE INDEX IF NOT EXISTS
        idx_ledger_entries_device
      ON ledger_entries(device_id);

      CREATE INDEX IF NOT EXISTS
        idx_ledger_entries_customer_occurred
      ON ledger_entries(customer_id, occurred_at);


      CREATE TABLE IF NOT EXISTS entry_items (
        id TEXT PRIMARY KEY NOT NULL,
        ledger_entry_id TEXT NOT NULL,
        item_id TEXT,
        name TEXT NOT NULL,

        amount INTEGER NOT NULL
          CHECK (amount > 0),

        FOREIGN KEY (ledger_entry_id)
          REFERENCES ledger_entries(id),

        FOREIGN KEY (item_id)
          REFERENCES items(id)
      );

      CREATE INDEX IF NOT EXISTS
        idx_entry_items_ledger_entry
      ON entry_items(ledger_entry_id);

      CREATE INDEX IF NOT EXISTS
        idx_entry_items_item
      ON entry_items(item_id);


      PRAGMA user_version = 1;
    `);
  });
}