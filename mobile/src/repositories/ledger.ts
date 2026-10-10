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



export interface LedgerHistoryCursor {
  occurredAt: string;
  createdAt: string;
  id: string;
}

export interface LedgerHistoryFilter {
  from?: string; // Inclusive ISO timestamp
  to?: string;   // Exclusive ISO timestamp
}

export interface LedgerHistoryWithBalance
  extends LedgerHistoryEntry {
  balance_after: number;
}

export interface LedgerHistoryPage {
  entries: LedgerHistoryWithBalance[];
  nextCursor: LedgerHistoryCursor | null;
  hasMore: boolean;
}

export interface ShopLedgerSummary {
  totalMoneyOut: number;
  totalMoneyIn: number;
}

interface ShopLedgerSummaryRow {
  total_money_out: number;
  total_money_in: number;
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


export interface CustomerLedgerSummary {
  totalUdhaar: number;
  totalPayments: number;
  outstanding: number;
}

interface CustomerLedgerSummaryRow {
  total_udhaar: number;
  total_payments: number;
  outstanding: number;
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
        created_at,
        deleted_at,
        deleted_by_device_id
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
          le.deleted_at,
          le.deleted_by_device_id,

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
          AND le.deleted_at IS NULL

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



async getHistoryPage(
  shopId: string,
  customerId: string,
  options: {
    limit?: number;
    cursor?: LedgerHistoryCursor | null;
    filter?: LedgerHistoryFilter;
  } = {}
): Promise<LedgerHistoryPage> {
  const db = await getDatabase();

  const limit = Math.min(
    100,
    Math.max(1, options.limit ?? 30)
  );

  const conditions: string[] = [];
  const params: (string | number)[] = [
    customerId,
    shopId,
  ];

  if (options.filter?.from) {
    conditions.push('h.occurred_at >= ?');
    params.push(options.filter.from);
  }

  if (options.filter?.to) {
    conditions.push('h.occurred_at < ?');
    params.push(options.filter.to);
  }

  if (options.cursor) {
    conditions.push(`
      (
        h.occurred_at < ?
        OR (
          h.occurred_at = ?
          AND h.created_at < ?
        )
        OR (
          h.occurred_at = ?
          AND h.created_at = ?
          AND h.id < ?
        )
      )
    `);

    params.push(
      options.cursor.occurredAt,
      options.cursor.occurredAt,
      options.cursor.createdAt,
      options.cursor.occurredAt,
      options.cursor.createdAt,
      options.cursor.id
    );
  }

  const whereExtra = conditions.length
    ? `AND ${conditions.join(' AND ')}`
    : '';

  const rows =
    await db.getAllAsync<LedgerHistoryWithBalance>(
      `
        WITH history AS (
          SELECT
            le.id,
            le.customer_id,
            le.device_id,
            le.type,
            le.amount,
            le.note,
            le.occurred_at,
            le.created_at,
            le.deleted_at,
            le.deleted_by_device_id,

            SUM(
              CASE
                WHEN le.type = 'UDHAAR'
                  THEN le.amount
                WHEN le.type = 'PAYMENT'
                  THEN -le.amount
                ELSE 0
              END
            ) OVER (
              ORDER BY
                le.occurred_at ASC,
                le.created_at ASC,
                le.id ASC
              ROWS BETWEEN
                UNBOUNDED PRECEDING
                AND CURRENT ROW
            ) AS balance_after

          FROM ledger_entries AS le

          INNER JOIN customers AS c
            ON c.id = le.customer_id

          WHERE
            le.customer_id = ?
            AND c.shop_id = ?
            AND le.deleted_at IS NULL
        )

        SELECT
          h.*,

          (
            SELECT GROUP_CONCAT(ei.name, ', ')
            FROM entry_items AS ei
            WHERE ei.ledger_entry_id = h.id
          ) AS item_names

        FROM history AS h

        WHERE 1 = 1
          ${whereExtra}

        ORDER BY
          h.occurred_at DESC,
          h.created_at DESC,
          h.id DESC

        LIMIT ?
      `,
      ...params,
      limit + 1
    );

  const hasMore = rows.length > limit;
  const entries = rows.slice(0, limit);
  const last = entries[entries.length - 1];

  return {
    entries,
    hasMore,
    nextCursor:
      hasMore && last
        ? {
            occurredAt: last.occurred_at,
            createdAt: last.created_at,
            id: last.id,
          }
        : null,
  };
}



/**
 * Calculate the complete customer ledger summary.
 *
 * - Includes all active ledger entries.
 * - Excludes soft-deleted entries.
 * - Validates the customer belongs to the shop.
 * - Does not depend on pagination or filters.
 * - Works entirely with local SQLite.
 */
async getCustomerLedgerSummary(
  shopId: string,
  customerId: string
): Promise<CustomerLedgerSummary> {
  const db = await getDatabase();

  const row =
    await db.getFirstAsync<CustomerLedgerSummaryRow>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN le.type = 'UDHAAR'
                  THEN le.amount
                ELSE 0
              END
            ),
            0
          ) AS total_udhaar,

          COALESCE(
            SUM(
              CASE
                WHEN le.type = 'PAYMENT'
                  THEN le.amount
                ELSE 0
              END
            ),
            0
          ) AS total_payments,

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
          ) AS outstanding

        FROM ledger_entries AS le

        INNER JOIN customers AS c
          ON c.id = le.customer_id

        WHERE
          le.customer_id = ?
          AND c.shop_id = ?
          AND le.deleted_at IS NULL
      `,
      customerId,
      shopId
    );

  return {
    totalUdhaar: row?.total_udhaar ?? 0,
    totalPayments: row?.total_payments ?? 0,
    outstanding: row?.outstanding ?? 0,
  };
}




  async softDeleteWithDatabase(
  db: SQLiteDatabase,
  entryId: string,
  deviceId: string,
  deletedAt: string
): Promise<boolean> {
  const result = await db.runAsync(
    `
      UPDATE ledger_entries
      SET
        deleted_at = ?,
        deleted_by_device_id = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    deletedAt,
    deviceId,
    entryId
  );

  return result.changes === 1;
}


async getShopLedgerSummary(
  shopId: string
): Promise<ShopLedgerSummary> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ShopLedgerSummaryRow>(
    `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN le.type = 'UDHAAR'
                THEN le.amount
              ELSE 0
            END
          ),
          0
        ) AS total_money_out,

        COALESCE(
          SUM(
            CASE
              WHEN le.type = 'PAYMENT'
                THEN le.amount
              ELSE 0
            END
          ),
          0
        ) AS total_money_in

      FROM ledger_entries AS le

      INNER JOIN customers AS c
        ON c.id = le.customer_id

      WHERE
        c.shop_id = ?
        AND le.deleted_at IS NULL
    `,
    shopId
  );

  return {
    totalMoneyOut: row?.total_money_out ?? 0,
    totalMoneyIn: row?.total_money_in ?? 0,
  };
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
              AND le.deleted_at IS NULL
        `,
        customerId,
        shopId
      );

    return row?.balance ?? 0;
  }
}