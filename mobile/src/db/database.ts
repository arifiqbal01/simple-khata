import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;

let databasePromise:
  | Promise<SQLite.SQLiteDatabase>
  | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    return Promise.resolve(database);
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = openDatabase();

  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  try {
    const db =
      await SQLite.openDatabaseAsync(
        'simple-khata.db'
      );

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    database = db;

    return db;
  } catch (error) {
    /*
     * Allow a later attempt to retry initialization
     * if opening/configuring the database failed.
     */
    databasePromise = null;

    throw error;
  }
}