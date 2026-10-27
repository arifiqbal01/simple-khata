import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Item } from '@/types/domain';

export interface CreateItemValues {
  id: string;
  shopId: string;
  name: string;
  createdAt: string;
  defaultUnit?: string | null;
  defaultSellingPrice?: number | null;
}

export interface UpdateItemValues {
  id: string;
  shopId: string;
  name: string;
  defaultUnit: string | null;
  defaultSellingPrice: number | null;
}

export interface DeleteItemValues {
  id: string;
  shopId: string;
  deviceId: string;
  deletedAt: string;
}

export interface BulkDeleteItemsValues {
  shopId: string;
  itemIds: string[];
  deviceId: string;
  deletedAt: string;
}

const ITEM_COLUMNS = `
  id,
  shop_id,
  name,
  created_at,
  default_unit,
  default_selling_price,
  deleted_at,
  deleted_by_device_id
`;

function validateItemName(name: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new Error('Item name is required');
  }

  if (normalized.length > 150) {
    throw new Error(
      'Item name cannot exceed 150 characters'
    );
  }

  return normalized;
}

function validateUnit(
  unit: string | null | undefined
): string | null {
  const normalized = unit?.trim() || null;

  if (normalized && normalized.length > 30) {
    throw new Error(
      'Item unit cannot exceed 30 characters'
    );
  }

  return normalized;
}

function validatePrice(
  price: number | null | undefined
): number | null {
  if (price == null) {
    return null;
  }

  if (!Number.isSafeInteger(price) || price < 0) {
    throw new Error(
      'Default selling price must be a non-negative integer'
    );
  }

  return price;
}

export class ItemRepository {
  async create(
    values: CreateItemValues
  ): Promise<Item> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const item = await this.getByIdAndShop(
      values.id,
      values.shopId
    );

    if (!item) {
      throw new Error(
        'Item could not be loaded after creation'
      );
    }

    return item;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateItemValues
  ): Promise<void> {
    await db.runAsync(
      `
        INSERT INTO items (
          id,
          shop_id,
          name,
          created_at,
          default_unit,
          default_selling_price,
          deleted_at,
          deleted_by_device_id
        )
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
      `,
      values.id,
      values.shopId,
      validateItemName(values.name),
      values.createdAt,
      validateUnit(values.defaultUnit),
      validatePrice(values.defaultSellingPrice)
    );
  }

  async updateWithDatabase(
    db: SQLiteDatabase,
    values: UpdateItemValues
  ): Promise<boolean> {
    const result = await db.runAsync(
      `
        UPDATE items
        SET
          name = ?,
          default_unit = ?,
          default_selling_price = ?
        WHERE id = ?
          AND shop_id = ?
          AND deleted_at IS NULL
      `,
      validateItemName(values.name),
      validateUnit(values.defaultUnit),
      validatePrice(values.defaultSellingPrice),
      values.id,
      values.shopId
    );

    return result.changes > 0;
  }

  async softDeleteWithDatabase(
    db: SQLiteDatabase,
    values: DeleteItemValues
  ): Promise<boolean> {
    const result = await db.runAsync(
      `
        UPDATE items
        SET
          deleted_at = ?,
          deleted_by_device_id = ?
        WHERE id = ?
          AND shop_id = ?
          AND deleted_at IS NULL
      `,
      values.deletedAt,
      values.deviceId,
      values.id,
      values.shopId
    );

    return result.changes > 0;
  }

  async getById(
    itemId: string
  ): Promise<Item | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Item>(
      `
        SELECT ${ITEM_COLUMNS}
        FROM items
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      itemId
    );
  }

  async getByIdAndShop(
    itemId: string,
    shopId: string
  ): Promise<Item | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Item>(
      `
        SELECT ${ITEM_COLUMNS}
        FROM items
        WHERE id = ?
          AND shop_id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      itemId,
      shopId
    );
  }

  async getByIdIncludingDeleted(
    itemId: string,
    shopId: string
  ): Promise<Item | null> {
    const db = await getDatabase();

    return db.getFirstAsync<Item>(
      `
        SELECT ${ITEM_COLUMNS}
        FROM items
        WHERE id = ?
          AND shop_id = ?
        LIMIT 1
      `,
      itemId,
      shopId
    );
  }

  async listByShop(
    shopId: string,
    limit = 100,
    offset = 0
  ): Promise<Item[]> {
    const db = await getDatabase();

    return db.getAllAsync<Item>(
      `
        SELECT ${ITEM_COLUMNS}
        FROM items
        WHERE shop_id = ?
          AND deleted_at IS NULL
        ORDER BY
          created_at DESC,
          id DESC
        LIMIT ?
        OFFSET ?
      `,
      shopId,
      limit,
      offset
    );
  }


async softDeleteManyWithDatabase(
  db: SQLiteDatabase,
  values: BulkDeleteItemsValues
): Promise<string[]> {
  const itemIds = [...new Set(values.itemIds)];

  if (itemIds.length === 0) {
    return [];
  }

  if (!values.shopId.trim()) {
    throw new Error('Shop ID is required');
  }

  if (!values.deviceId.trim()) {
    throw new Error('Device ID is required');
  }

  if (itemIds.some((id) => !id.trim())) {
    throw new Error('Item IDs cannot be empty');
  }

  const deletedIds: string[] = [];

  // SQLite has a limit on SQL bound parameters.
  // Process items in safe batches.
  const BATCH_SIZE = 400;

  for (
    let index = 0;
    index < itemIds.length;
    index += BATCH_SIZE
  ) {
    const batch = itemIds.slice(
      index,
      index + BATCH_SIZE
    );

    const placeholders = batch
      .map(() => '?')
      .join(', ');

    // Capture only active items belonging to this shop.
    const activeRows = await db.getAllAsync<{
      id: string;
    }>(
      `
        SELECT id
        FROM items
        WHERE shop_id = ?
          AND deleted_at IS NULL
          AND id IN (${placeholders})
      `,
      values.shopId,
      ...batch
    );

    if (activeRows.length === 0) {
      continue;
    }

    const activeIds = activeRows.map(
      (row) => row.id
    );

    const activePlaceholders = activeIds
      .map(() => '?')
      .join(', ');

    await db.runAsync(
      `
        UPDATE items
        SET
          deleted_at = ?,
          deleted_by_device_id = ?
        WHERE shop_id = ?
          AND deleted_at IS NULL
          AND id IN (${activePlaceholders})
      `,
      values.deletedAt,
      values.deviceId,
      values.shopId,
      ...activeIds
    );

    deletedIds.push(...activeIds);
  }

  return deletedIds;
}


async countByShop(shopId: string): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{
    total: number;
  }>(
    `
      SELECT COUNT(*) AS total
      FROM items
      WHERE shop_id = ?
        AND deleted_at IS NULL
    `,
    shopId
  );

  return result?.total ?? 0;
}



  async getByNameAndShop(
    shopId: string,
    name: string
  ): Promise<Item | null> {
    const db = await getDatabase();
    const normalized = name.trim();

    if (!shopId.trim() || !normalized) {
      return null;
    }

    return db.getFirstAsync<Item>(
      `
        SELECT ${ITEM_COLUMNS}
        FROM items
        WHERE shop_id = ?
          AND deleted_at IS NULL
          AND LOWER(TRIM(name)) = LOWER(?)
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      shopId,
      normalized
    );
  }

  async getManyByIds(
    shopId: string,
    itemIds: string[]
  ): Promise<Item[]> {
    const ids = [
      ...new Set(
        itemIds.filter((id) => id.trim())
      ),
    ];

    if (!shopId.trim() || ids.length === 0) {
      return [];
    }

    const db = await getDatabase();
    const results: Item[] = [];
    const batchSize = 400;

    for (
      let index = 0;
      index < ids.length;
      index += batchSize
    ) {
      const batch = ids.slice(
        index,
        index + batchSize
      );

      const placeholders = batch
        .map(() => '?')
        .join(', ');

      const rows = await db.getAllAsync<Item>(
        `
          SELECT ${ITEM_COLUMNS}
          FROM items
          WHERE shop_id = ?
            AND deleted_at IS NULL
            AND id IN (${placeholders})
        `,
        shopId,
        ...batch
      );

      results.push(...rows);
    }

    return results;
  }

  async getManyByNames(
    shopId: string,
    names: string[]
  ): Promise<Item[]> {
    const normalizedNames = [
      ...new Set(
        names
          .map((name) =>
            name.trim().toLocaleLowerCase()
          )
          .filter(Boolean)
      ),
    ];

    if (
      !shopId.trim() ||
      normalizedNames.length === 0
    ) {
      return [];
    }

    const db = await getDatabase();
    const results: Item[] = [];
    const batchSize = 400;

    for (
      let index = 0;
      index < normalizedNames.length;
      index += batchSize
    ) {
      const batch = normalizedNames.slice(
        index,
        index + batchSize
      );

      const placeholders = batch
        .map(() => '?')
        .join(', ');

      const rows = await db.getAllAsync<Item>(
        `
          SELECT ${ITEM_COLUMNS}
          FROM items
          WHERE shop_id = ?
            AND deleted_at IS NULL
            AND LOWER(TRIM(name)) IN (${placeholders})
          ORDER BY
            name COLLATE NOCASE ASC,
            id ASC
        `,
        shopId,
        ...batch
      );

      results.push(...rows);
    }

    return results;
  }




  async search(
    shopId: string,
    query: string,
    limit = 50,
    offset = 0
  ): Promise<Item[]> {
    const normalizedShopId = shopId.trim();
    const normalizedQuery = query.trim();

    if (!normalizedShopId) {
      throw new Error('Shop ID is required');
    }

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new Error(
        'Limit must be between 1 and 100'
      );
    }

    if (
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        'Offset cannot be negative'
      );
    }

    /*
     * Preserve catalog browsing for callers
     * that pass an empty search query.
     */
    if (!normalizedQuery) {
      return this.listByShop(
        normalizedShopId,
        limit,
        offset
      );
    }

    /*
     * Escape SQL LIKE wildcards so the
     * user's search is treated literally.
     *
     * The backslash is the escape character:
     *   %  -> \%
     *   _  -> \_
     *   \  -> \\
     */
    const escapedQuery = normalizedQuery.replace(
      /[\\%_]/g,
      '\\$&'
    );

    const containsPattern = `%${escapedQuery}%`;

    const db = await getDatabase();

    return db.getAllAsync<Item>(
      `
        SELECT ${ITEM_COLUMNS}
        FROM items
        WHERE shop_id = ?
          AND deleted_at IS NULL
          AND TRIM(name) LIKE ? ESCAPE '\\'
        ORDER BY
          created_at DESC,
          id DESC
        LIMIT ?
        OFFSET ?
      `,
      normalizedShopId,
      containsPattern,
      limit,
      offset
    );
  }
}