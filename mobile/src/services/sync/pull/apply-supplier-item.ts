import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncChange } from '@/api/syncApi';

interface SupplierItemIdentity {
  id: string;
  shopId: string;
  supplierId: string;
  itemId: string;
}

interface SupplierItemData extends SupplierItemIdentity {
  unit: string;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface ExistingSupplierItem {
  id: string;
  shop_id: string;
  supplier_id: string;
  item_id: string;
  updated_at: string;
}

interface ForeignKeyRow {
  table: string;
  from: string;
  to: string;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function readIdentity(
  payload: unknown
): SupplierItemIdentity {
  if (
    !isRecord(payload) ||
    !isRecord(payload.supplierItem)
  ) {
    throw new Error('Invalid supplier-item sync payload');
  }

  const value = payload.supplierItem;

  if (
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.shopId !== 'string' ||
    !value.shopId ||
    typeof value.supplierId !== 'string' ||
    !value.supplierId ||
    typeof value.itemId !== 'string' ||
    !value.itemId
  ) {
    throw new Error('Invalid supplier-item identity');
  }

  return {
    id: value.id,
    shopId: value.shopId,
    supplierId: value.supplierId,
    itemId: value.itemId,
  };
}

function readSupplierItem(
  payload: unknown
): SupplierItemData {
  const identity = readIdentity(payload);
  const value = (
    payload as {
      supplierItem: Record<string, unknown>;
    }
  ).supplierItem;

  if (
    typeof value.unit !== 'string' ||
    !value.unit.trim() ||
    value.unit.trim().length > 30 ||
    typeof value.unitPrice !== 'number' ||
    !Number.isSafeInteger(value.unitPrice) ||
    value.unitPrice < 0 ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.updatedAt))
  ) {
    throw new Error('Invalid supplier-item values');
  }

  return {
    ...identity,
    unit: value.unit.trim(),
    unitPrice: value.unitPrice,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

async function getExisting(
  db: SQLiteDatabase,
  shopId: string,
  id: string
): Promise<ExistingSupplierItem | null> {
  return db.getFirstAsync<ExistingSupplierItem>(
    `
      SELECT
        id,
        shop_id,
        supplier_id,
        item_id,
        updated_at
      FROM supplier_items
      WHERE id = ?
        AND shop_id = ?
      LIMIT 1
    `,
    id,
    shopId
  );
}

async function getAssociation(
  db: SQLiteDatabase,
  data: SupplierItemIdentity
): Promise<ExistingSupplierItem | null> {
  return db.getFirstAsync<ExistingSupplierItem>(
    `
      SELECT
        id,
        shop_id,
        supplier_id,
        item_id,
        updated_at
      FROM supplier_items
      WHERE supplier_id = ?
        AND item_id = ?
      LIMIT 1
    `,
    data.supplierId,
    data.itemId
  );
}

function assertIdentityMatches(
  existing: ExistingSupplierItem,
  identity: SupplierItemIdentity
): void {
  if (
    existing.shop_id !== identity.shopId ||
    existing.supplier_id !== identity.supplierId ||
    existing.item_id !== identity.itemId
  ) {
    throw new Error(
      'Remote supplier-item association mismatch'
    );
  }
}

async function validateDependencies(
  db: SQLiteDatabase,
  shopId: string,
  identity: SupplierItemIdentity
): Promise<void> {
  const supplier = await db.getFirstAsync<{ id: string }>(
    `
      SELECT id
      FROM parties
      WHERE id = ?
        AND shop_id = ?
        AND type = 'SUPPLIER'
        AND deleted_at IS NULL
      LIMIT 1
    `,
    identity.supplierId,
    shopId
  );

  if (!supplier) {
    throw new Error(
      'Remote supplier-item supplier is missing or inactive'
    );
  }

  const item = await db.getFirstAsync<{ id: string }>(
    `
      SELECT id
      FROM items
      WHERE id = ?
        AND shop_id = ?
        AND deleted_at IS NULL
      LIMIT 1
    `,
    identity.itemId,
    shopId
  );

  if (!item) {
    throw new Error(
      'Remote supplier-item catalog item is missing or inactive'
    );
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Verify that the old association UUID is not referenced
 * by any other local table through a declared foreign key.
 */
async function assertNoForeignKeyReferences(
  db: SQLiteDatabase,
  localId: string
): Promise<void> {
  const tables = await db.getAllAsync<{
    name: string;
  }>(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `
  );

  for (const table of tables) {
    const foreignKeys = await db.getAllAsync<ForeignKeyRow>(
      `PRAGMA foreign_key_list(${quoteIdentifier(table.name)})`
    );

    for (const foreignKey of foreignKeys) {
      if (foreignKey.table !== 'supplier_items') {
        continue;
      }

      const referencingColumn = quoteIdentifier(
        foreignKey.from
      );

      const reference = await db.getFirstAsync<{
        found: number;
      }>(
        `
          SELECT 1 AS found
          FROM ${quoteIdentifier(table.name)}
          WHERE ${referencingColumn} = ?
          LIMIT 1
        `,
        localId
      );

      if (reference) {
        throw new Error(
          `Cannot reconcile supplier-item ID: referenced by ${table.name}.${foreignKey.from}`
        );
      }
    }
  }
}

/**
 * The sync_outbox stores serialized operation payloads.
 *
 * A conservative text check prevents changing a local ID
 * that is still mentioned by an operation waiting to sync.
 *
 * This assumes the existing sync_outbox schema includes
 * a payload column; verify against the actual migration.
 */
async function assertNoPendingOutboxReferences(
  db: SQLiteDatabase,
  localId: string
): Promise<void> {
  const columns = await db.getAllAsync<{
    name: string;
  }>('PRAGMA table_info(sync_outbox)');

  const names = new Set(columns.map((column) => column.name));

  if (!names.has('payload')) {
    throw new Error(
      'Cannot verify supplier-item outbox references: payload column not found'
    );
  }

  const references = await db.getFirstAsync<{
    found: number;
  }>(
    `
      SELECT 1 AS found
      FROM sync_outbox
      WHERE instr(CAST(payload AS TEXT), ?) > 0
      LIMIT 1
    `,
    localId
  );

  if (references) {
    throw new Error(
      'Cannot reconcile supplier-item ID: referenced by sync outbox'
    );
  }
}

/**
 * Reconcile a local association with the server UUID.
 *
 * Called only from the existing pull transaction.
 * The transaction must also include the cursor update.
 */
async function reconcileAssociationId(
  db: SQLiteDatabase,
  shopId: string,
  data: SupplierItemData
): Promise<void> {
  const association = await getAssociation(db, data);

  if (!association || association.id === data.id) {
    return;
  }

  if (association.shop_id !== shopId) {
    throw new Error(
      'Supplier-item identity conflict across shops'
    );
  }

  const remoteIdRow = await db.getFirstAsync<{
    id: string;
  }>(
    `
      SELECT id
      FROM supplier_items
      WHERE id = ?
      LIMIT 1
    `,
    data.id
  );

  if (remoteIdRow) {
    throw new Error(
      'Cannot reconcile supplier-item ID: remote ID already belongs to another row'
    );
  }

  await assertNoForeignKeyReferences(db, association.id);
  await assertNoPendingOutboxReferences(db, association.id);

  const result = await db.runAsync(
    `
      UPDATE supplier_items
      SET id = ?
      WHERE id = ?
        AND shop_id = ?
        AND supplier_id = ?
        AND item_id = ?
    `,
    data.id,
    association.id,
    shopId,
    data.supplierId,
    data.itemId
  );

  if (result.changes !== 1) {
    throw new Error(
      'Supplier-item identity reconciliation did not update exactly one row'
    );
  }

}

async function applyUpsert(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const data = readSupplierItem(change.payload);

  if (data.id !== change.entityId) {
    throw new Error('Remote supplier-item ID mismatch');
  }

  if (data.shopId !== shopId) {
    throw new Error(
      'Remote supplier item belongs to another shop'
    );
  }

  await validateDependencies(db, shopId, data);

  await reconcileAssociationId(db, shopId, data);

  const existing = await getExisting(db, shopId, data.id);

  if (existing) {
    assertIdentityMatches(existing, data);
  }

  await db.runAsync(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)

      ON CONFLICT(id) DO UPDATE SET
        unit = excluded.unit,
        unit_price = excluded.unit_price,
        updated_at = excluded.updated_at

      WHERE supplier_items.shop_id = excluded.shop_id
        AND supplier_items.supplier_id = excluded.supplier_id
        AND supplier_items.item_id = excluded.item_id
        AND excluded.updated_at >= supplier_items.updated_at
    `,
    data.id,
    shopId,
    data.supplierId,
    data.itemId,
    data.unit,
    data.unitPrice,
    data.createdAt,
    data.updatedAt
  );

}

async function applyDelete(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  const identity = readIdentity(change.payload);

  if (identity.id !== change.entityId) {
    throw new Error(
      'Remote supplier-item delete ID mismatch'
    );
  }

  if (identity.shopId !== shopId) {
    throw new Error(
      'Remote supplier-item deletion belongs to another shop'
    );
  }

  const existing = await getExisting(
    db,
    shopId,
    identity.id
  );

  if (!existing) {
    return;
  }

  assertIdentityMatches(existing, identity);

  await db.runAsync(
    `
      DELETE FROM supplier_items
      WHERE id = ?
        AND shop_id = ?
        AND supplier_id = ?
        AND item_id = ?
    `,
    identity.id,
    shopId,
    identity.supplierId,
    identity.itemId
  );
}

/**
 * Apply a supplier-item change from the server.
 *
 * Caller must execute this inside the pull transaction
 * together with the cursor update.
 */
export async function applySupplierItemChange(
  db: SQLiteDatabase,
  shopId: string,
  change: SyncChange
): Promise<void> {
  if (change.entityType !== 'SUPPLIER_ITEM') {
    throw new Error('Invalid supplier-item entity type');
  }

  switch (change.operationType) {
    case 'SUPPLIER_ITEM_CREATE':
    case 'SUPPLIER_ITEM_UPDATE':
      await applyUpsert(db, shopId, change);
      return;

    case 'SUPPLIER_ITEM_DELETE':
      await applyDelete(db, shopId, change);
      return;

    default:
      throw new Error(
        `Unsupported supplier-item operation: ${change.operationType}`
      );
  }
}