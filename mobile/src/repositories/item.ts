import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Item } from '@/types/domain';

export interface CreateItemValues {
  id: string;
  shopId: string;
  name: string;
  createdAt: string;
}

export class ItemRepository {
  async create(
    values: CreateItemValues
  ): Promise<Item> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const item = await this.getById(values.id);

    if (!item) {
      throw new Error(
        'Item could not be loaded after creation'
      );
    }

    return item;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateItemValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO items (
          id,
          shop_id,
          name,
          created_at
        )
        VALUES (?, ?, ?, ?)
      `,
      values.id,
      values.shopId,
      values.name,
      values.createdAt
    );
  }

  async getById(
    itemId: string
  ): Promise<Item | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Item>(
      `
        SELECT
          id,
          shop_id,
          name,
          created_at
        FROM items
        WHERE id = ?
        LIMIT 1
      `,
      itemId
    );
  }

  async getByIdAndShop(
    itemId: string,
    shopId: string
  ): Promise<Item | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Item>(
      `
        SELECT
          id,
          shop_id,
          name,
          created_at
        FROM items
        WHERE
          id = ?
          AND shop_id = ?
        LIMIT 1
      `,
      itemId,
      shopId
    );
  }

  async listByShop(
    shopId: string,
    limit = 100,
    offset = 0
  ): Promise<Item[]> {
    const db = await getDatabase();

    return db.getAllAsync<Item>(
      `
        SELECT
          id,
          shop_id,
          name,
          created_at
        FROM items
        WHERE shop_id = ?
        ORDER BY
          name COLLATE NOCASE ASC,
          id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      limit,
      offset
    );
  }

  async search(
    shopId: string,
    query: string,
    limit = 50,
    offset = 0
  ): Promise<Item[]> {
    const db = await getDatabase();

    const searchQuery = `%${query}%`;

    return db.getAllAsync<Item>(
      `
        SELECT
          id,
          shop_id,
          name,
          created_at
        FROM items
        WHERE
          shop_id = ?
          AND name LIKE ? COLLATE NOCASE
        ORDER BY
          name COLLATE NOCASE ASC,
          id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      searchQuery,
      limit,
      offset
    );
  }
}