import { getDatabase } from '@/db/database';
import { ItemRepository } from '@/repositories/item';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import type { Item } from '@/types/domain';

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
      id: crypto.randomUUID(),
      shopId: input.shopId,
      name,
      createdAt: now,
    };

    const operationId = crypto.randomUUID();

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.itemRepository.createWithDatabase(
        db,
        item
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
            item,
          },

          createdAt: now,
        }
      );
    });

    return item;
  }
}