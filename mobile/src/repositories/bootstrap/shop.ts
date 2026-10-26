
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
    const id = values.id.trim();
    const name = values.name.trim();

    if (!id) {
      throw new Error('Shop ID is required');
    }

    if (!name) {
      throw new Error('Shop name is required');
    }

    if (!values.createdAt.trim()) {
      throw new Error('Shop creation date is required');
    }

    await db.runAsync(
      `
        INSERT INTO shops (
          id,
          name,
          created_at
        )
        VALUES (?, ?, ?)
      `,
      id,
      name,
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
        ORDER BY
          created_at ASC,
          id ASC
        LIMIT 1
      `
    );
  }
}
