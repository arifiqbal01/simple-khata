import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Device } from '@/types/domain';

export interface CreateDeviceValues {
  id: string;
  shopId: string;
  name: string | null;
  createdAt: string;
}

export class DeviceRepository {
  async create(
    values: CreateDeviceValues
  ): Promise<Device> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const device = await this.getById(values.id);

    if (!device) {
      throw new Error(
        'Device could not be loaded after creation'
      );
    }

    return device;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateDeviceValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO devices (
          id,
          shop_id,
          name,
          last_sync_at,
          created_at
        )
        VALUES (?, ?, ?, NULL, ?)
      `,
      values.id,
      values.shopId,
      values.name,
      values.createdAt
    );
  }

  async getById(
    deviceId: string
  ): Promise<Device | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Device>(
      `
        SELECT
          id,
          shop_id,
          name,
          last_sync_at,
          created_at
        FROM devices
        WHERE id = ?
        LIMIT 1
      `,
      deviceId
    );
  }
}