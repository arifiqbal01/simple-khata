
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';
import {
  SupplierItemRepository,
} from '@/repositories/item/supplier-item';
import {
  SyncOutboxRepository,
} from '@/repositories/sync/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';

export interface DeleteSupplierItemInput {
  id: string;
  shopId: string;
  deviceId: string;
  supplierId: string;
}

interface SupplierItemIdentityRow {
  id: string;
  supplier_id: string;
  item_id: string;
}

export class DeleteSupplierItemService {
  constructor(
    private readonly supplierItemRepository:
      SupplierItemRepository,
    private readonly syncOutboxRepository:
      SyncOutboxRepository
  ) {}

  async execute(
    input: DeleteSupplierItemInput
  ): Promise<void> {
    const id = input.id.trim();
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();
    const supplierId = input.supplierId.trim();

    if (!id || !shopId || !deviceId || !supplierId) {
      throw new Error(
        'Supplier item, shop, device and supplier IDs are required'
      );
    }

    let deleted = false;

    await runWriteTransaction(async (db) => {
      const existing =
        await db.getFirstAsync<SupplierItemIdentityRow>(
          `
            SELECT id, supplier_id, item_id
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
          throw new Error(
            'Supplier product was not found for this supplier. Please refresh and try again.'
          );
        }

      const removed = await this.supplierItemRepository
        .deleteWithDatabase(db, {
          id,
          shopId,
          supplierId,
        });

      if (!removed) {
        throw new Error('Unable to delete supplier product');
      }

      const now = new Date().toISOString();

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: Crypto.randomUUID(),
          shopId,
          deviceId,
          operationType: 'SUPPLIER_ITEM_DELETE',
          entityType: 'SUPPLIER_ITEM',
          entityId: id,
          payload: {
            supplierItem: {
              id,
              shopId,
              supplierId,
              itemId: existing.item_id,
            },
          },
          createdAt: now,
        }
      );

      deleted = true;
    });

    if (deleted) {
      void requestSync().catch((error: unknown) => {
        console.warn('Supplier-item delete sync failed:', error);
      });
    }
  }
}
