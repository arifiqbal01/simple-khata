
import { getDatabase } from '@/db/database';
import type {
  PartyLedgerEntry,
} from '@/repositories/ledger/ledger';

export interface LedgerHistoryCursor {
  occurredAt: string;
  createdAt: string;
  id: string;
}

export interface LedgerHistoryFilter {
  from?: string;
  to?: string;
}

export interface LedgerHistoryEntry
  extends PartyLedgerEntry {
  item_names: string | null;
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

export class LedgerHistoryRepository {
  async listByParty(
    shopId: string,
    partyId: string,
    limit = 100,
    offset = 0
  ): Promise<LedgerHistoryEntry[]> {
    const db = await getDatabase();

    return db.getAllAsync<LedgerHistoryEntry>(
      `
        SELECT
          le.id,
          le.party_id,
          le.device_id,
          le.type,
          le.amount,
          le.note,
          le.occurred_at,
          le.created_at,
          le.deleted_at,
          le.deleted_by_device_id,

          (
            SELECT GROUP_CONCAT(ei.name, ', ')
            FROM entry_items AS ei
            WHERE ei.ledger_entry_id = le.id
          ) AS item_names

        FROM ledger_entries AS le

        INNER JOIN parties AS p
          ON p.id = le.party_id

        WHERE le.party_id = ?
          AND p.shop_id = ?
          AND le.deleted_at IS NULL

        ORDER BY
          le.occurred_at DESC,
          le.created_at DESC,
          le.id DESC

        LIMIT ?
        OFFSET ?
      `,
      partyId,
      shopId,
      limit,
      offset
    );
  }

  async getHistoryPage(
    shopId: string,
    partyId: string,
    options: {
      limit?: number;
      cursor?: LedgerHistoryCursor | null;
      filter?: LedgerHistoryFilter;
    } = {}
  ): Promise<LedgerHistoryPage> {
    const db = await getDatabase();

    const requestedLimit = options.limit ?? 30;

    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1
    ) {
      throw new Error('Invalid history page limit');
    }

    const limit = Math.min(100, requestedLimit);

    const conditions: string[] = [];
    const params: (string | number)[] = [
      partyId,
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
              le.party_id,
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
                  WHEN p.type = 'CUSTOMER'
                    AND le.type = 'UDHAAR'
                    THEN le.amount

                  WHEN p.type = 'SUPPLIER'
                    AND le.type = 'SUPPLY'
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

            INNER JOIN parties AS p
              ON p.id = le.party_id

            WHERE le.party_id = ?
              AND p.shop_id = ?
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
}
