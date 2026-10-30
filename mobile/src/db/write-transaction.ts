
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

type DatabaseTask<T> = (
  db: SQLiteDatabase
) => Promise<T>;

let transactionQueue: Promise<void> = Promise.resolve();

/**
 * Run a database operation exclusively through the
 * shared application queue.
 *
 * This does NOT open a transaction.
 *
 * Suitable for operations such as VACUUM INTO,
 * which must run outside a transaction.
 */
export function runExclusiveDatabaseOperation<T>(
  task: DatabaseTask<T>
): Promise<T> {
  const operation = transactionQueue.then(async () => {
    const db = await getDatabase();
    return task(db);
  });

  transactionQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}

/**
 * Run a SQLite write transaction in the shared queue.
 *
 * Do not nest this function or call it from inside
 * runExclusiveDatabaseOperation().
 */
export function runWriteTransaction<T>(
  task: DatabaseTask<T>
): Promise<T> {
  return runExclusiveDatabaseOperation(async (db) => {
    let result!: T;

    await db.withTransactionAsync(async () => {
      result = await task(db);
    });

    return result;
  });
}
