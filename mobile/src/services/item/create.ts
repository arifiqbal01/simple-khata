import { getDatabase } from '@/db/database';
import { ItemRepository } from '@/repositories/item';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { Item } from '@/types/domain';
import * as Crypto from 'expo-crypto';

export interface CreateItemInput {
  shopId: string;
  deviceId: string;
  name: string;
}

export class CreateItemService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: CreateItemInput
  ): Promise<Item> {
    const name = input.name.trim();

    if (!input.shopId) {
      throw new Error('Shop ID is required');
    }

    if (!input.deviceId) {
      throw new Error('Device ID is required');
    }

    if (!name) {
      throw new Error('Item name is required');
    }

    if (name.length > 150) {
      throw new Error(
        'Item name cannot be longer than 150 characters'
      );
    }

    const now = new Date().toISOString();

    const item: Item = {
      id: Crypto.randomUUID(),
      shop_id: input.shopId,
      name,
      created_at: now,
    };

    const operationId = Crypto.randomUUID();

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.itemRepository.createWithDatabase(
        db,
        {
          id: item.id,
          shopId: item.shop_id,
          name: item.name,
          createdAt: item.created_at,
        }
      );

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: operationId,
          shopId: input.shopId,
          deviceId: input.deviceId,

          operationType: 'ITEM_CREATE',
          entityType: 'ITEM',
          entityId: item.id,

          payload: {
            item: {
              ...item,
              updatedAt: now,
            },
          },

          createdAt: now,
        }
      );
    });

    // Local mutation + outbox transaction has committed.
    // Sync is intentionally fire-and-forget so network
    // failure never causes the local item creation to fail.
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] item-create failed',
        error
      );
    });

    return item;
  }
}