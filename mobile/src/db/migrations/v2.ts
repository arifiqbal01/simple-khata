import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration v2
 *
 * Makes entry_items.amount nullable.
 *
 * The database connection is provided by the migration runner
 * so migrations share a single SQLite connection.
 */
export async function migrateToVersion2(
  db: SQLiteDatabase
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE entry_items_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        ledger_entry_id TEXT NOT NULL,
        item_id TEXT,
        name TEXT NOT NULL,
        amount INTEGER,

        FOREIGN KEY (ledger_entry_id)
          REFERENCES ledger_entries(id),

        FOREIGN KEY (item_id)
          REFERENCES items(id)
      );

      INSERT INTO entry_items_v2 (
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

      ALTER TABLE entry_items_v2
        RENAME TO entry_items;

      CREATE INDEX IF NOT EXISTS
        idx_entry_items_ledger_entry
      ON entry_items(ledger_entry_id);

      CREATE INDEX IF NOT EXISTS
        idx_entry_items_item
      ON entry_items(item_id);

      PRAGMA user_version = 2;
    `);
  });
}