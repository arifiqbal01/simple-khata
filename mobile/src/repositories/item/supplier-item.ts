
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/db/database';
import type { SupplierItem } from '@/types/domain';

export interface CreateSupplierItemValues {
  id: string;
  shopId: string;
  supplierId: string;
  itemId: string;
  unit: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSupplierItemValues {
  id: string;
  shopId: string;
  supplierId: string;
  unit: string;
  unitPrice: number;
  updatedAt: string;
}

export interface DeleteSupplierItemValues {
  id: string;
  shopId: string;
  supplierId: string;
}

export interface SupplierItemWithDetails
  extends SupplierItem {
  item_name: string;
  item_default_unit: string | null;
  item_default_selling_price: number | null;
}

const SUPPLIER_ITEM_COLUMNS = `
  si.id,
  si.shop_id,
  si.supplier_id,
  si.item_id,
  si.unit,
  si.unit_price,
  si.created_at,
  si.updated_at
`;

function validateUnit(unit: string): string {
  const normalized = unit.trim();

  if (!normalized) {
    throw new Error('Supplier item unit is required');
  }

  if (normalized.length > 30) {
    throw new Error(
      'Supplier item unit cannot exceed 30 characters'
    );
  }

  return normalized;
}

function validateUnitPrice(price: number): number {
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new Error(
      'Supplier item price must be a non-negative integer'
    );
  }

  return price;
}

/**
 * SQLite v6 supplier-item repository.
 *
 * A supplier item links one active SUPPLIER party
 * to one active catalog item in the same shop.
 *
 * Mutations do not automatically enqueue sync
 * operations. The calling service must handle
 * synchronization according to the backend contract.
 */
export class SupplierItemRepository {
  async create(
    values: CreateSupplierItemValues
  ): Promise<SupplierItem> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const supplierItem = await this.getByIdAndShop(
      values.id,
      values.shopId
    );

    if (!supplierItem) {
      throw new Error(
        'Supplier item could not be loaded after creation'
      );
    }

    return supplierItem;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateSupplierItemValues
  ): Promise<void> {
    const result = await db.runAsync(
      `
        INSERT INTO supplier_items (
          id,
          shop_id,
          supplier_id,
          item_id,
          unit,
          unit_price,
          created_at,
          updated_at
        )
        SELECT
          ?, ?, p.id, i.id, ?, ?, ?, ?
        FROM parties AS p
        INNER JOIN items AS i
          ON i.id = ?
          AND i.shop_id = p.shop_id
          AND i.deleted_at IS NULL
        WHERE p.id = ?
          AND p.shop_id = ?
          AND p.type = 'SUPPLIER'
          AND p.deleted_at IS NULL
      `,
      values.id,
      values.shopId,
      validateUnit(values.unit),
      validateUnitPrice(values.unitPrice),
      values.createdAt,
      values.updatedAt,
      values.itemId,
      values.supplierId,
      values.shopId
    );

    if (result.changes !== 1) {
      throw new Error(
        'Supplier or item does not exist, is deleted, or belongs to another shop'
      );
    }
  }

  async updateWithDatabase(
    db: SQLiteDatabase,
    values: UpdateSupplierItemValues
  ): Promise<boolean> {
    const result = await db.runAsync(
      `
        UPDATE supplier_items
        SET
          unit = ?,
          unit_price = ?,
          updated_at = ?
        WHERE id = ?
          AND shop_id = ?
          AND supplier_id = ?
          AND EXISTS (
            SELECT 1
            FROM parties AS p
            INNER JOIN items AS i
              ON i.id = supplier_items.item_id
              AND i.shop_id = p.shop_id
              AND i.deleted_at IS NULL
            WHERE p.id = supplier_items.supplier_id
              AND p.shop_id = supplier_items.shop_id
              AND p.type = 'SUPPLIER'
              AND p.deleted_at IS NULL
          )
      `,
      validateUnit(values.unit),
      validateUnitPrice(values.unitPrice),
      values.updatedAt,
      values.id,
      values.shopId,
      values.supplierId
    );

    return result.changes > 0;
  }

  /**
   * Hard-deletes the association, not the Party
   * or catalog item.
   *
   * Historical ledger item snapshots are preserved.
   *
   * Do not call this for synced data until the
   * backend supports the corresponding deletion.
   */
  async deleteWithDatabase(
    db: SQLiteDatabase,
    values: DeleteSupplierItemValues
  ): Promise<boolean> {
    const result = await db.runAsync(
      `
        DELETE FROM supplier_items
        WHERE id = ?
          AND shop_id = ?
          AND supplier_id = ?
      `,
      values.id,
      values.shopId,
      values.supplierId
    );

    return result.changes > 0;
  }

  async getById(
    supplierItemId: string
  ): Promise<SupplierItem | null> {
    const db = await getDatabase();

    return db.getFirstAsync<SupplierItem>(
      `
        SELECT ${SUPPLIER_ITEM_COLUMNS}
        FROM supplier_items AS si
        WHERE si.id = ?
        LIMIT 1
      `,
      supplierItemId
    );
  }

  async getByIdAndShop(
    supplierItemId: string,
    shopId: string
  ): Promise<SupplierItem | null> {
    const db = await getDatabase();

    return db.getFirstAsync<SupplierItem>(
      `
        SELECT ${SUPPLIER_ITEM_COLUMNS}
        FROM supplier_items AS si
        WHERE si.id = ?
          AND si.shop_id = ?
        LIMIT 1
      `,
      supplierItemId,
      shopId
    );
  }

  async getBySupplierAndItem(
    shopId: string,
    supplierId: string,
    itemId: string
  ): Promise<SupplierItem | null> {
    const db = await getDatabase();

    return db.getFirstAsync<SupplierItem>(
      `
        SELECT ${SUPPLIER_ITEM_COLUMNS}
        FROM supplier_items AS si
        WHERE si.shop_id = ?
          AND si.supplier_id = ?
          AND si.item_id = ?
        LIMIT 1
      `,
      shopId,
      supplierId,
      itemId
    );
  }

  async listBySupplier(
    shopId: string,
    supplierId: string,
    limit = 100,
    offset = 0
  ): Promise<SupplierItemWithDetails[]> {
    const db = await getDatabase();

    return db.getAllAsync<SupplierItemWithDetails>(
      `
        SELECT
          ${SUPPLIER_ITEM_COLUMNS},
          i.name AS item_name,
          i.default_unit AS item_default_unit,
          i.default_selling_price
            AS item_default_selling_price
        FROM supplier_items AS si
        INNER JOIN parties AS p
          ON p.id = si.supplier_id
          AND p.shop_id = si.shop_id
          AND p.type = 'SUPPLIER'
          AND p.deleted_at IS NULL
        INNER JOIN items AS i
          ON i.id = si.item_id
          AND i.shop_id = si.shop_id
          AND i.deleted_at IS NULL
        WHERE si.shop_id = ?
          AND si.supplier_id = ?
        ORDER BY
          i.name COLLATE NOCASE ASC,
          si.id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      supplierId,
      limit,
      offset
    );
  }

  async listByItem(
    shopId: string,
    itemId: string,
    limit = 100,
    offset = 0
  ): Promise<SupplierItem[]> {
    const db = await getDatabase();

    return db.getAllAsync<SupplierItem>(
      `
        SELECT ${SUPPLIER_ITEM_COLUMNS}
        FROM supplier_items AS si
        INNER JOIN parties AS p
          ON p.id = si.supplier_id
          AND p.shop_id = si.shop_id
          AND p.type = 'SUPPLIER'
          AND p.deleted_at IS NULL
        INNER JOIN items AS i
          ON i.id = si.item_id
          AND i.shop_id = si.shop_id
          AND i.deleted_at IS NULL
        WHERE si.shop_id = ?
          AND si.item_id = ?
        ORDER BY
          si.updated_at DESC,
          si.id ASC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      itemId,
      limit,
      offset
    );
  }
}