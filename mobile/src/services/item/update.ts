
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';
import { ItemRepository } from '@/repositories/item/item';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { Item } from '@/types/domain';

export interface UpdateItemInput {
  shopId: string;
  deviceId: string;
  itemId: string;
  name: string;
  defaultUnit: string | null;
  defaultSellingPrice: number | null;
}

export class UpdateItemService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(input: UpdateItemInput): Promise<Item> {
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();
    const itemId = input.itemId.trim();
    const name = input.name.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    if (!itemId) {
      throw new Error('Item ID is required');
    }

    if (!name || name.length > 150) {
      throw new Error(
        'Item name must contain 1 to 150 characters'
      );
    }

    const defaultUnit =
      input.defaultUnit?.trim() || null;

    if (defaultUnit && defaultUnit.length > 30) {
      throw new Error(
        'Default unit cannot exceed 30 characters'
      );
    }

    const defaultSellingPrice =
      input.defaultSellingPrice;

    if (
      defaultSellingPrice !== null &&
      (!Number.isSafeInteger(defaultSellingPrice) ||
        defaultSellingPrice < 0)
    ) {
      throw new Error(
        'Selling price must be a non-negative integer'
      );
    }

    const existing =
      await this.itemRepository.getByIdAndShop(
        itemId,
        shopId
      );

    if (!existing) {
      throw new Error('Item not found');
    }

    const updatedAt = new Date().toISOString();

    await runWriteTransaction(async (db) => {
      const updated =
        await this.itemRepository.updateWithDatabase(
          db,
          {
            id: itemId,
            shopId,
            name,
            defaultUnit,
            defaultSellingPrice,
          }
        );

      if (!updated) {
        throw new Error(
          'Item could not be updated'
        );
      }

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: Crypto.randomUUID(),
          shopId,
          deviceId,
          operationType: 'ITEM_UPDATE',
          entityType: 'ITEM',
          entityId: itemId,
          payload: {
            item: {
              id: itemId,
              shopId,
              name,
              defaultUnit,
              defaultSellingPrice,
              createdAt: existing.created_at,
              updatedAt,
            },
          },
          createdAt: updatedAt,
        }
      );
    });

    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] item-update failed',
        error
      );
    });

    const item =
      await this.itemRepository.getByIdAndShop(
        itemId,
        shopId
      );

    if (!item) {
      throw new Error(
        'Item could not be loaded after update'
      );
    }

    return item;
  }
}
