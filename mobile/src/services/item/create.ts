
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';
import { ItemRepository } from '@/repositories/item/item';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { Item } from '@/types/domain';

export interface CreateItemInput {
  shopId: string;
  deviceId: string;
  name: string;

  defaultUnit?: string | null;
  defaultSellingPrice?: number | null;
}

export class CreateItemService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(input: CreateItemInput): Promise<Item> {
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();
    const name = input.name.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!deviceId) {
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

    const defaultUnit =
      input.defaultUnit?.trim() || null;

    if (defaultUnit && defaultUnit.length > 30) {
      throw new Error(
        'Default unit cannot exceed 30 characters'
      );
    }

    const defaultSellingPrice =
      input.defaultSellingPrice ?? null;

    if (
      defaultSellingPrice !== null &&
      (
        !Number.isSafeInteger(defaultSellingPrice) ||
        defaultSellingPrice < 0
      )
    ) {
      throw new Error(
        'Default selling price must be a non-negative integer'
      );
    }

    const now = new Date().toISOString();

    const item: Item = {
      id: Crypto.randomUUID(),
      shop_id: shopId,
      name,
      created_at: now,
      default_unit: defaultUnit,
      default_selling_price: defaultSellingPrice,
      deleted_at: null,
      deleted_by_device_id: null,
    };

    const operationId = Crypto.randomUUID();

    /*
     * Create the item and enqueue its sync operation
     * in the same SQLite transaction.
     *
     * runWriteTransaction coordinates this write
     * with other users of the same helper.
     */
    await runWriteTransaction(async (db) => {
      await this.itemRepository.createWithDatabase(
        db,
        {
          id: item.id,
          shopId: item.shop_id,
          name: item.name,
          createdAt: item.created_at,
          defaultUnit: item.default_unit,
          defaultSellingPrice:
            item.default_selling_price,
        }
      );

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: operationId,
          shopId,
          deviceId,

          operationType: 'ITEM_CREATE',
          entityType: 'ITEM',
          entityId: item.id,

          payload: {
            item: {
              id: item.id,
              shopId: item.shop_id,
              name: item.name,
              defaultUnit: item.default_unit,
              defaultSellingPrice:
                item.default_selling_price,
              createdAt: item.created_at,
              updatedAt: now,
            },
          },

          createdAt: now,
        }
      );
    });

    /*
     * Sync starts only after the local transaction
     * commits successfully.
     *
     * Network failure must not undo local creation.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] item-create failed',
        error
      );
    });

    return item;
  }
}
