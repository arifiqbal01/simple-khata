// src/repositories/sync-state.ts

import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

interface SyncStateRow {
  shop_id: string;
  pull_cursor: number;
  last_successful_sync_at: string | null;
  last_push_at: string | null;
  last_pull_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export class SyncStateRepository {
  async getPullCursor(
    shopId: string
  ): Promise<number> {
    const db = await getDatabase();

    return this.getPullCursorWithDatabase(
      db,
      shopId
    );
  }

  async getPullCursorWithDatabase(
    db: SQLiteDatabase,
    shopId: string
  ): Promise<number> {
    const row =
      await db.getFirstAsync<SyncStateRow>(
        `
          SELECT
            shop_id,
            pull_cursor,
            last_successful_sync_at,
            last_push_at,
            last_pull_at,
            last_error,
            updated_at
          FROM sync_state
          WHERE shop_id = ?
          LIMIT 1
        `,
        shopId
      );

    /*
     * No sync state yet means this shop has
     * never pulled from the server.
     */
    if (!row) {
      return 0;
    }

    const cursor = row.pull_cursor;

    if (
      !Number.isSafeInteger(cursor) ||
      cursor < 0
    ) {
      throw new Error(
        `Invalid pull cursor for shop ${shopId}: ${cursor}`
      );
    }

    return cursor;
  }

  async setPullCursor(
    shopId: string,
    cursor: number
  ): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(
      async () => {
        await this.setPullCursorWithDatabase(
          db,
          shopId,
          cursor
        );
      }
    );
  }

  async setPullCursorWithDatabase(
    db: SQLiteDatabase,
    shopId: string,
    cursor: number
  ): Promise<void> {
    validateCursor(cursor);

    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO sync_state (
          shop_id,
          pull_cursor,
          last_pull_at,
          last_error,
          updated_at
        )
        VALUES (?, ?, ?, NULL, ?)

        ON CONFLICT(shop_id)
        DO UPDATE SET
          pull_cursor = excluded.pull_cursor,
          last_pull_at = excluded.last_pull_at,
          last_error = NULL,
          updated_at = excluded.updated_at
      `,
      shopId,
      cursor,
      now,
      now
    );
  }

  async markPushSuccess(
    shopId: string
  ): Promise<void> {
    const db = await getDatabase();

    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO sync_state (
          shop_id,
          pull_cursor,
          last_push_at,
          last_error,
          updated_at
        )
        VALUES (?, 0, ?, NULL, ?)

        ON CONFLICT(shop_id)
        DO UPDATE SET
          last_push_at = excluded.last_push_at,
          last_error = NULL,
          updated_at = excluded.updated_at
      `,
      shopId,
      now,
      now
    );
  }

  async markSyncSuccess(
    shopId: string
  ): Promise<void> {
    const db = await getDatabase();

    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO sync_state (
          shop_id,
          pull_cursor,
          last_successful_sync_at,
          last_error,
          updated_at
        )
        VALUES (?, 0, ?, NULL, ?)

        ON CONFLICT(shop_id)
        DO UPDATE SET
          last_successful_sync_at =
            excluded.last_successful_sync_at,
          last_error = NULL,
          updated_at = excluded.updated_at
      `,
      shopId,
      now,
      now
    );
  }

  async markSyncError(
    shopId: string,
    error: string
  ): Promise<void> {
    const db = await getDatabase();

    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO sync_state (
          shop_id,
          pull_cursor,
          last_error,
          updated_at
        )
        VALUES (?, 0, ?, ?)

        ON CONFLICT(shop_id)
        DO UPDATE SET
          last_error = excluded.last_error,
          updated_at = excluded.updated_at
      `,
      shopId,
      error,
      now
    );
  }
}

function validateCursor(
  cursor: number
): void {
  if (
    !Number.isSafeInteger(cursor) ||
    cursor < 0
  ) {
    throw new Error(
      `Invalid sync pull cursor: ${cursor}`
    );
  }
}

export const syncStateRepository =
  new SyncStateRepository();