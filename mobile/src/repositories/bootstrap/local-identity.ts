import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';

export interface LocalIdentity {
  shopId: string;
  deviceId: string;
  createdAt: string;
}

interface LocalIdentityRow {
  shop_id: string;
  device_id: string;
  created_at: string;
}

export interface CreateLocalIdentityValues {
  shopId: string;
  deviceId: string;
  createdAt: string;
}

export class LocalIdentityRepository {
  async get(): Promise<LocalIdentity | null> {
    const db = await getDatabase();

    return this.getWithDatabase(db);
  }

  async getWithDatabase(
    db: SQLiteDatabase
  ): Promise<LocalIdentity | null> {
    const row =
      await db.getFirstAsync<LocalIdentityRow>(
        `
          SELECT
            shop_id,
            device_id,
            created_at
          FROM local_identity
          WHERE singleton = 1
          LIMIT 1
        `
      );

    if (!row) {
      return null;
    }

    return {
      shopId: row.shop_id,
      deviceId: row.device_id,
      createdAt: row.created_at,
    };
  }

  async create(
    values: CreateLocalIdentityValues
  ): Promise<LocalIdentity> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.createWithDatabase(
        db,
        values
      );
    });

    return {
      shopId: values.shopId,
      deviceId: values.deviceId,
      createdAt: values.createdAt,
    };
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateLocalIdentityValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO local_identity (
          singleton,
          shop_id,
          device_id,
          created_at
        )
        VALUES (1, ?, ?, ?)
      `,
      values.shopId,
      values.deviceId,
      values.createdAt
    );
  }

  async exists(): Promise<boolean> {
    const identity = await this.get();

    return identity !== null;
  }
}

export const localIdentityRepository =
  new LocalIdentityRepository();