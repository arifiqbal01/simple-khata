import { getDatabase } from '@/db/database';
import type { EntryItem } from '@/types/domain';

export interface CreateEntryItemValues {
  id: string;
  ledgerEntryId: string;
  itemId: string | null;
  name: string;
  amount?: number | null;
}

export class EntryItemRepository {
  async create(
    values: CreateEntryItemValues
  ): Promise<EntryItem> {
    const db = await getDatabase();

    await db.runAsync(
      `
        INSERT INTO entry_items (
          id,
          ledger_entry_id,
          item_id,
          name,
          amount
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      values.id,
      values.ledgerEntryId,
      values.itemId,
      values.name,
      values.amount ?? null
    );

    const entryItem = await this.getById(values.id);

    if (!entryItem) {
      throw new Error(
        'Entry item could not be loaded after creation'
      );
    }

    return entryItem;
  }

  async getById(
    entryItemId: string
  ): Promise<EntryItem | null> {
    const db = await getDatabase();

    return db.getFirstAsync<EntryItem>(
      `
        SELECT
          id,
          ledger_entry_id,
          item_id,
          name,
          amount
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
        SELECT
          id,
          ledger_entry_id,
          item_id,
          name,
          amount
        FROM entry_items
        WHERE ledger_entry_id = ?
        ORDER BY id ASC
      `,
      ledgerEntryId
    );
  }
}