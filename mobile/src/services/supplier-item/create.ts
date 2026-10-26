
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';

import {
  SupplierItemRepository,
} from '@/repositories/item/supplier-item';

import {
  SyncOutboxRepository,
} from '@/repositories/sync/sync-outbox';

import { requestSync } from '@/services/sync/sync-coordinator';

export interface CreateSupplierItemInput {
  shopId: string;
  deviceId: string;
  supplierId: string;
  itemId: string;
  unit: string;
  unitPrice: number;
}

export interface CreatedSupplierItem {
  id: string;
  shopId: string;
  supplierId: string;
  itemId: string;
  unit: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export class CreateSupplierItemService {
  constructor(
    private readonly supplierItemRepository:
      SupplierItemRepository,
    private readonly syncOutboxRepository:
      SyncOutboxRepository
  ) {}

  async execute(
    input: CreateSupplierItemInput
  ): Promise<CreatedSupplierItem> {
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();
    const supplierId = input.supplierId.trim();
    const itemId = input.itemId.trim();
    const unit = input.unit.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    if (!supplierId) {
      throw new Error('Supplier ID is required');
    }

    if (!itemId) {
      throw new Error('Item ID is required');
    }

    if (!unit || unit.length > 30) {
      throw new Error(
        'Unit must contain 1 to 30 characters'
      );
    }

    if (
      !Number.isSafeInteger(input.unitPrice) ||
      input.unitPrice < 0
    ) {
      throw new Error(
        'Purchase price must be a nonnegative integer'
      );
    }

    const now = new Date().toISOString();

    const supplierItem: CreatedSupplierItem = {
      id: Crypto.randomUUID(),
      shopId,
      supplierId,
      itemId,
      unit,
      unitPrice: input.unitPrice,
      createdAt: now,
      updatedAt: now,
    };

    console.log(
      '[supplier-item] CREATE requested',
      {
        supplierItemId: supplierItem.id,
        shopId,
        supplierId,
        itemId,
        unit,
        unitPrice: supplierItem.unitPrice,
      }
    );

    try {
      console.log(
        '[supplier-item] TRANSACTION starting'
      );

      await runWriteTransaction(async (db) => {
        console.log(
          '[supplier-item] INSERT starting'
        );

        // Create the supplier-product association locally.
        // The repository validates the supplier and item.
        await this.supplierItemRepository.createWithDatabase(
          db,
          {
            id: supplierItem.id,
            shopId: supplierItem.shopId,
            supplierId: supplierItem.supplierId,
            itemId: supplierItem.itemId,
            unit: supplierItem.unit,
            unitPrice: supplierItem.unitPrice,
            createdAt: supplierItem.createdAt,
            updatedAt: supplierItem.updatedAt,
          }
        );

        console.log(
          '[supplier-item] INSERT succeeded'
        );

        console.log(
          '[supplier-item] OUTBOX starting'
        );

        // Queue the same operation for backend sync.
        // Both writes succeed or both roll back.
        await this.syncOutboxRepository.enqueueWithDatabase(
          db,
          {
            id: Crypto.randomUUID(),
            shopId,
            deviceId,
            operationType: 'SUPPLIER_ITEM_CREATE',
            entityType: 'SUPPLIER_ITEM',
            entityId: supplierItem.id,
            payload: {
              supplierItem: {
                id: supplierItem.id,
                shopId: supplierItem.shopId,
                supplierId: supplierItem.supplierId,
                itemId: supplierItem.itemId,
                unit: supplierItem.unit,
                unitPrice: supplierItem.unitPrice,
                createdAt: supplierItem.createdAt,
                updatedAt: supplierItem.updatedAt,
              },
            },
            createdAt: now,
          }
        );

        console.log(
          '[supplier-item] OUTBOX succeeded'
        );
      });

      console.log(
        '[supplier-item] TRANSACTION committed'
      );
    } catch (error: unknown) {
      console.error(
        '[supplier-item] TRANSACTION failed',
        error
      );

      if (error instanceof Error) {
        console.error(
          '[supplier-item] Error message:',
          error.message
        );

        console.error(
          '[supplier-item] Error stack:',
          error.stack
        );
      }

      // Preserve the original error for the form hook.
      throw error;
    }

    // Local save is already committed.
    // A sync failure must not undo the offline write.
    void requestSync().catch((error: unknown) => {
      console.warn(
        '[supplier-item] SYNC request failed:',
        error
      );
    });

    console.log(
      '[supplier-item] CREATE completed locally',
      {
        supplierItemId: supplierItem.id,
      }
    );

    return supplierItem;
  }
}
