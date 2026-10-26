
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';
import { ItemRepository } from '@/repositories/item/item';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';

export interface DeleteItemInput {
  shopId: string;
  deviceId: string;
  itemId: string;
}

export interface DeleteItemsInput {
  shopId: string;
  deviceId: string;
  itemIds: string[];
}

export interface DeleteItemsResult {
  deletedIds: string[];
  deletedCount: number;
}

export class DeleteItemService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: DeleteItemInput
  ): Promise<boolean> {
    const result = await this.executeBulk({
      shopId: input.shopId,
      deviceId: input.deviceId,
      itemIds: [input.itemId],
    });

    return result.deletedCount > 0;
  }

  async executeBulk(
    input: DeleteItemsInput
  ): Promise<DeleteItemsResult> {
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    if (!Array.isArray(input.itemIds)) {
      throw new Error('Item IDs must be an array');
    }

    const itemIds = [
      ...new Set(input.itemIds.map((id) => id.trim())),
    ];

    if (itemIds.some((id) => !id)) {
      throw new Error('Item IDs cannot be empty');
    }

    if (itemIds.length === 0) {
      return {
        deletedIds: [],
        deletedCount: 0,
      };
    }

    const deletedAt = new Date().toISOString();

    const deletedIds = await runWriteTransaction(
      async (db) => {
        const ids =
          await this.itemRepository.softDeleteManyWithDatabase(
            db,
            {
              shopId,
              itemIds,
              deviceId,
              deletedAt,
            }
          );

        /*
         * Each item gets its own sync operation.
         *
         * All deletions and outbox writes occur
         * in the same transaction.
         */
        for (const itemId of ids) {
          await this.syncOutboxRepository.enqueueWithDatabase(
            db,
            {
              id: Crypto.randomUUID(),
              shopId,
              deviceId,

              operationType: 'ITEM_DELETE',
              entityType: 'ITEM',
              entityId: itemId,

              payload: {
                itemId,
                shopId,
                deletedAt,
                deletedByDeviceId: deviceId,
              },

              createdAt: deletedAt,
            }
          );
        }

        return ids;
      }
    );

    if (deletedIds.length > 0) {
      void requestSync().catch((error) => {
        console.warn(
          '[sync-trigger] item-delete failed',
          error
        );
      });
    }

    return {
      deletedIds,
      deletedCount: deletedIds.length,
    };
  }
}
