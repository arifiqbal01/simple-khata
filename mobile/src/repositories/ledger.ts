import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  LedgerEntry,
  LedgerEntryType,
} from '@/types/domain';

export interface CreateLedgerEntryValues {
  id: string;
  customerId: string;
  deviceId: string;
  type: LedgerEntryType;
  amount: number;
  note?: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface CreateUdhaarItemValues {
  id: string;
  itemId: string | null;
  name: string;
}

export interface CreateUdhaarWithItemsValues {
  entry: CreateLedgerEntryValues;
  items: CreateUdhaarItemValues[];
}

/**
 * Ledger entry returned for customer history.
 *
 * item_names is a comma-separated snapshot of the items
 * attached to an UDHAAR entry.
 *
 * Examples:
 *   "Milk, Sugar"
 *   "Atta 10kg, Cooking Oil"
 *   null
 */
export interface LedgerHistoryEntry
  extends LedgerEntry {
  item_names: string | null;
}

interface BalanceRow {
  balance: number;
}

export class LedgerRepository {
  async create(
    values: CreateLedgerEntryValues
  ): Promise<LedgerEntry> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const entry = await this.getById(values.id);

    if (!entry) {
      throw new Error(
        'Ledger entry could not be loaded after creation'
      );
    }

    return entry;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateLedgerEntryValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO ledger_entries (
          id,
          customer_id,
          device_id,
          type,
          amount,
          note,
          occurred_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values.id,
      values.customerId,
      values.deviceId,
      values.type,
      values.amount,
      values.note ?? null,
      values.occurredAt,
      values.createdAt
    );
  }

  async createUdhaarWithItems(
    values: CreateUdhaarWithItemsValues
  ): Promise<LedgerEntry> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.createUdhaarWithItemsWithDatabase(
        db,
        values
      );
    });

    const entry = await this.getById(
      values.entry.id
    );

    if (!entry) {
      throw new Error(
        'Udhaar entry could not be loaded after creation'
      );
    }

    return entry;
  }

  async createUdhaarWithItemsWithDatabase(
    db: SQLiteDatabase,
    values: CreateUdhaarWithItemsValues
  ): Promise<void> {
    if (values.entry.type !== 'UDHAAR') {
      throw new Error(
        'createUdhaarWithItemsWithDatabase only accepts UDHAAR entries'
      );
    }

    await this.createWithDatabase(
      db,
      values.entry
    );

    for (const item of values.items) {
      await db.runAsync(
        `
          INSERT INTO entry_items (
            id,
            ledger_entry_id,
            item_id,
            name,
            amount
          )
          VALUES (?, ?, ?, ?, NULL)
        `,
        item.id,
        values.entry.id,
        item.itemId,
        item.name
      );
    }
  }

  async getById(
    entryId: string
  ): Promise<LedgerEntry | null> {
    const db = await getDatabase();

    return db.getFirstAsync<LedgerEntry>(
      `
        SELECT
          id,
          customer_id,
          device_id,
          type,
          amount,
          note,
          occurred_at,
          created_at
        FROM ledger_entries
        WHERE id = ?
        LIMIT 1
      `,
      entryId
    );
  }

  async listByCustomer(
    shopId: string,
    customerId: string,
    limit = 100,
    offset = 0
  ): Promise<LedgerHistoryEntry[]> {
    const db = await getDatabase();

    return db.getAllAsync<LedgerHistoryEntry>(
      `
        SELECT
          le.id,
          le.customer_id,
          le.device_id,
          le.type,
          le.amount,
          le.note,
          le.occurred_at,
          le.created_at,

          (
            SELECT GROUP_CONCAT(
              ei.name,
              ', '
            )
            FROM entry_items AS ei
            WHERE ei.ledger_entry_id = le.id
          ) AS item_names

        FROM ledger_entries AS le

        INNER JOIN customers AS c
          ON c.id = le.customer_id

        WHERE
          le.customer_id = ?
          AND c.shop_id = ?

        ORDER BY
          le.occurred_at DESC,
          le.created_at DESC,
          le.id DESC

        LIMIT ?
        OFFSET ?
      `,
      customerId,
      shopId,
      limit,
      offset
    );
  }

  async getCustomerBalance(
    shopId: string,
    customerId: string
  ): Promise<number> {
    const db = await getDatabase();

    const row =
      await db.getFirstAsync<BalanceRow>(
        `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN le.type = 'UDHAAR'
                    THEN le.amount
                  WHEN le.type = 'PAYMENT'
                    THEN -le.amount
                  ELSE 0
                END
              ),
              0
            ) AS balance

          FROM ledger_entries AS le

          INNER JOIN customers AS c
            ON c.id = le.customer_id

          WHERE
            le.customer_id = ?
            AND c.shop_id = ?
        `,
        customerId,
        shopId
      );

    return row?.balance ?? 0;
  }
}