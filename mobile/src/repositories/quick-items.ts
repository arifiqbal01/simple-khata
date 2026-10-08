
import { getDatabase } from '@/db/database';

export interface ItemUsage {
  itemId: string | null;
  name: string;
  totalCount: number;
  customerCount: number;
  timeCount: number;
}

export interface QuickItemUsageOptions {
  shopId: string;
  customerId: string;
  startHour: number;
  endHour: number;
  since: string;
  recentSince: string;
  timezoneOffsetMinutes: number;
}

export class QuickItemsRepository {
  async getUsage(
    options: QuickItemUsageOptions
  ): Promise<ItemUsage[]> {
    const db = await getDatabase();

    const {
      shopId,
      customerId,
      startHour,
      endHour,
      since,
      recentSince,
      timezoneOffsetMinutes,
    } = options;

    // SQLite modifier: UTC -> local wall-clock time.
    // JavaScript getTimezoneOffset() uses the opposite sign.
    const offset = -timezoneOffsetMinutes;
    const modifier = `${offset >= 0 ? '+' : ''}${offset} minutes`;

    // Handles ordinary and overnight windows.
    const overnight = startHour > endHour;

    return db.getAllAsync<ItemUsage>(
      `
        WITH usage_rows AS (
          SELECT DISTINCT
            le.id AS entry_id,
            le.customer_id,
            le.occurred_at,
            ei.item_id,
            LOWER(TRIM(ei.name)) AS normalized_name,
            ei.name AS display_name,

            CAST(
              strftime(
                '%H',
                le.occurred_at,
                ?
              ) AS INTEGER
            ) AS local_hour

          FROM entry_items AS ei

          INNER JOIN ledger_entries AS le
            ON le.id = ei.ledger_entry_id

          INNER JOIN customers AS c
            ON c.id = le.customer_id

          WHERE
            c.shop_id = ?
            AND le.type = 'UDHAAR'
            AND le.deleted_at IS NULL
            AND le.occurred_at >= ?
            AND TRIM(ei.name) <> ''
        )

        SELECT
          MAX(item_id) AS itemId,
          MIN(display_name) AS name,

          SUM(
            CASE
              WHEN occurred_at >= ? THEN 3
              ELSE 1
            END
          ) AS totalCount,

          SUM(
            CASE
              WHEN customer_id = ?
              THEN
                CASE
                  WHEN occurred_at >= ? THEN 3
                  ELSE 1
                END
              ELSE 0
            END
          ) AS customerCount,

          SUM(
            CASE
              WHEN (
                (? = 0
                  AND local_hour >= ?
                  AND local_hour < ?)
                OR
                (? = 1
                  AND (
                    local_hour >= ?
                    OR local_hour < ?
                  ))
              )
              THEN
                CASE
                  WHEN occurred_at >= ? THEN 3
                  ELSE 1
                END
              ELSE 0
            END
          ) AS timeCount

        FROM usage_rows

        GROUP BY normalized_name

        ORDER BY totalCount DESC

        LIMIT 200
      `,
      modifier,
      shopId,
      since,
      recentSince,
      customerId,
      recentSince,
      overnight ? 1 : 0,
      startHour,
      endHour,
      overnight ? 1 : 0,
      startHour,
      endHour,
      recentSince
    );
  }
}
