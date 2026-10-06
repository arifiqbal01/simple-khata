import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Shop } from '@/types/domain';

export interface CreateShopValues {
  id: string;
  name: string;
  createdAt: string;
}

export class ShopRepository {
  async create(
    values: CreateShopValues
  ): Promise<Shop> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const shop = await this.getById(values.id);

    if (!shop) {
      throw new Error(
        'Shop could not be loaded after creation'
      );
    }

    return shop;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateShopValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO shops (
          id,
          name,
          created_at
        )
        VALUES (?, ?, ?)
      `,
      values.id,
      values.name,
      values.createdAt
    );
  }

  async getById(
    shopId: string
  ): Promise<Shop | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Shop>(
      `
        SELECT
          id,
          name,
          created_at
        FROM shops
        WHERE id = ?
        LIMIT 1
      `,
      shopId
    );
  }

  async getFirst(): Promise<Shop | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Shop>(
      `
        SELECT
          id,
          name,
          created_at
        FROM shops
        ORDER BY created_at ASC
        LIMIT 1
      `
    );
  }
}