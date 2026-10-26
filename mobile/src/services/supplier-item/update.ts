
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';
import {
  SupplierItemRepository,
} from '@/repositories/item/supplier-item';
import {
  SyncOutboxRepository,
} from '@/repositories/sync/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';

export interface UpdateSupplierItemInput {
  id: string;
  shopId: string;
  deviceId: string;
  supplierId: string;
  unit: string;
  unitPrice: number;
}

export interface UpdatedSupplierItem {
  id: string;
  shopId: string;
  supplierId: string;
  itemId: string;
  unit: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface SupplierItemRow {
  id: string;
  shop_id: string;
  supplier_id: string;
  item_id: string;
  unit: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export class UpdateSupplierItemService {
  constructor(
    private readonly supplierItemRepository:
      SupplierItemRepository,
    private readonly syncOutboxRepository:
      SyncOutboxRepository
  ) {}

  async execute(
    input: UpdateSupplierItemInput
  ): Promise<UpdatedSupplierItem> {
    const id = input.id.trim();
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();
    const supplierId = input.supplierId.trim();
    const unit = input.unit.trim();

    if (!id || !shopId || !deviceId || !supplierId) {
      throw new Error(
        'Supplier item, shop, device and supplier IDs are required'
      );
    }

    if (!unit || unit.length > 30) {
      throw new Error('Unit must contain 1 to 30 characters');
    }

    if (
      !Number.isSafeInteger(input.unitPrice) ||
      input.unitPrice < 0
    ) {
      throw new Error(
        'Purchase price must be a nonnegative integer'
      );
    }

    let updatedItem: UpdatedSupplierItem | null = null;

    await runWriteTransaction(async (db) => {
      const existing = await db.getFirstAsync<SupplierItemRow>(
        `
          SELECT
            id,
            shop_id,
            supplier_id,
            item_id,
            unit,
            unit_price,
            created_at,
            updated_at
          FROM supplier_items
          WHERE id = ?
            AND shop_id = ?
            AND supplier_id = ?
          LIMIT 1
        `,
        id,
        shopId,
        supplierId
      );

      if (!existing) {
        throw new Error('Supplier product not found');
      }

      const now = new Date().toISOString();

      const changed =
        existing.unit !== unit ||
        existing.unit_price !== input.unitPrice;

      if (!changed) {
        updatedItem = {
          id: existing.id,
          shopId,
          supplierId,
          itemId: existing.item_id,
          unit: existing.unit,
          unitPrice: existing.unit_price,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
        };
        return;
      }

      const updated = await this.supplierItemRepository
        .updateWithDatabase(db, {
          id,
          shopId,
          supplierId,
          unit,
          unitPrice: input.unitPrice,
          updatedAt: now,
        });

      if (!updated) {
        throw new Error('Unable to update supplier product');
      }

      updatedItem = {
        id,
        shopId,
        supplierId,
        itemId: existing.item_id,
        unit,
        unitPrice: input.unitPrice,
        createdAt: existing.created_at,
        updatedAt: now,
      };

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: Crypto.randomUUID(),
          shopId,
          deviceId,
          operationType: 'SUPPLIER_ITEM_UPDATE',
          entityType: 'SUPPLIER_ITEM',
          entityId: id,
          payload: {
            supplierItem: updatedItem,
          },
          createdAt: now,
        }
      );
    });

    if (!updatedItem) {
      throw new Error('Supplier product update failed');
    }

    void requestSync().catch((error: unknown) => {
      console.warn('Supplier-item update sync failed:', error);
    });

    return updatedItem;
  }
}
