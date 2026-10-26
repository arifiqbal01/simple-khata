
import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { EntryItem } from '@/types/domain';

export interface CreateEntryItemValues {
  id: string;
  ledgerEntryId: string;
  itemId: string | null;
  name: string;
  amount?: number | null;
  quantity?: string | null;
  unit?: string | null;
  unitPrice?: number | null;
}

const ENTRY_ITEM_COLUMNS = `
  id,
  ledger_entry_id,
  item_id,
  name,
  amount,
  quantity,
  unit,
  unit_price
`;

function validateEntryItem(
  values: CreateEntryItemValues
): void {
  if (!values.name.trim()) {
    throw new Error('Entry item name is required');
  }

  if (values.name.trim().length > 150) {
    throw new Error(
      'Entry item name cannot exceed 150 characters'
    );
  }

  if (
    values.amount != null &&
    (
      !Number.isSafeInteger(values.amount) ||
      values.amount < 0
    )
  ) {
    throw new Error(
      'Entry item amount must be a non-negative integer'
    );
  }

  if (
    values.unitPrice != null &&
    (
      !Number.isSafeInteger(values.unitPrice) ||
      values.unitPrice < 0
    )
  ) {
    throw new Error(
      'Unit price must be a non-negative integer'
    );
  }

  if (
    values.unit != null &&
    values.unit.trim().length > 30
  ) {
    throw new Error(
      'Entry item unit cannot exceed 30 characters'
    );
  }

  if (values.quantity != null) {
    const quantity = values.quantity.trim();

    if (
      !/^(?:\d+)(?:\.\d+)?$/.test(quantity) ||
      !/[1-9]/.test(quantity.replace('.', ''))
    ) {
      throw new Error(
        'Quantity must be a positive decimal string'
      );
    }
  }
}

export class EntryItemRepository {
  async create(
    values: CreateEntryItemValues
  ): Promise<EntryItem> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const entryItem = await this.getById(values.id);

    if (!entryItem) {
      throw new Error(
        'Entry item could not be loaded after creation'
      );
    }

    return entryItem;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateEntryItemValues
  ): Promise<void> {
    validateEntryItem(values);

    await db.runAsync(
      `
        INSERT INTO entry_items (
          id,
          ledger_entry_id,
          item_id,
          name,
          amount,
          quantity,
          unit,
          unit_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values.id,
      values.ledgerEntryId,
      values.itemId,
      values.name.trim(),
      values.amount ?? null,
      values.quantity?.trim() || null,
      values.unit?.trim() || null,
      values.unitPrice ?? null
    );
  }

  async getById(
    entryItemId: string
  ): Promise<EntryItem | null> {
    const db = await getDatabase();

    return db.getFirstAsync<EntryItem>(
      `
        SELECT ${ENTRY_ITEM_COLUMNS}
        FROM entry_items
        WHERE id = ?
        LIMIT 1
      `,
      entryItemId
    );
  }

  async listByEntry(
    ledgerEntryId: string
  ): Promise<EntryItem[]> {
    const db = await getDatabase();

    return db.getAllAsync<EntryItem>(
      `
        SELECT ${ENTRY_ITEM_COLUMNS}
        FROM entry_items
        WHERE ledger_entry_id = ?
        ORDER BY id ASC
      `,
      ledgerEntryId
    );
  }
}
