
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

    if (
      !Number.isInteger(startHour) ||
      startHour < 0 ||
      startHour > 23 ||
      !Number.isInteger(endHour) ||
      endHour < 0 ||
      endHour > 23
    ) {
      throw new Error(
        'Start and end hours must be between 0 and 23'
      );
    }

    if (!Number.isInteger(timezoneOffsetMinutes)) {
      throw new Error(
        'Timezone offset must be an integer'
      );
    }

    // JavaScript's timezone offset uses the opposite sign.
    const offset = -timezoneOffsetMinutes;

    const modifier =
      `${offset >= 0 ? '+' : ''}${offset} minutes`;

    const overnight = startHour > endHour;

    return db.getAllAsync<ItemUsage>(
      `
        WITH usage_rows AS (
          SELECT DISTINCT
            le.id AS entry_id,
            le.party_id,
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

          INNER JOIN parties AS p
            ON p.id = le.party_id

          WHERE
            p.shop_id = ?
            AND p.type = 'CUSTOMER'
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
              WHEN party_id = ?
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
