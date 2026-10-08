
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

type TransactionTask<T> = (
  db: SQLiteDatabase
) => Promise<T>;

/**
 * Shared queue for SQLite write transactions.
 *
 * Prevents overlapping transactions on the
 * same database connection when all transactional
 * services use this helper.
 */
let transactionQueue: Promise<void> = Promise.resolve();

/**
 * Execute a database write transaction.
 *
 * - Runs transactions sequentially.
 * - Preserves atomic commits and rollbacks.
 * - Keeps the queue working after failures.
 * - Returns the callback's result.
 *
 * IMPORTANT:
 * Do not call runWriteTransaction() from inside
 * another runWriteTransaction() callback.
 */
export function runWriteTransaction<T>(
  task: TransactionTask<T>
): Promise<T> {
  const operation = transactionQueue.then(async () => {
    const db = await getDatabase();

    let result!: T;

    await db.withTransactionAsync(async () => {
      result = await task(db);
    });

    return result;
  });

  // A failed transaction must not block future writes.
  transactionQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}
