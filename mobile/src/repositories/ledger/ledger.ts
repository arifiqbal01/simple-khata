
import { getDatabase } from '@/db/database';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  LedgerEntry,
  LedgerEntryType,
} from '@/types/domain';
import {
  isValidSyncQuantity,
} from '@/utils/ledger/quantity-precision';

export type PartyLedgerEntry =
  Omit<LedgerEntry, 'customer_id'> & {
    party_id: string;
  };

export interface CreateLedgerEntryValues {
  id: string;
  partyId: string;
  deviceId: string;
  type: LedgerEntryType;
  amount: number;
  note?: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface CreateUdhaarItemValues {
  id: string;
  itemId: string | null;
  name: string;

  // Exact whole-rupee transaction amount.
  amount?: number | null;

  // Positive decimal quantity.
  quantity?: number | null;

  unit?: string | null;

  // Whole rupees per unit.
  unitPrice?: number | null;
}

export interface CreateUdhaarWithItemsValues {
  entry: CreateLedgerEntryValues;
  items: CreateUdhaarItemValues[];
}

const ENTRY_COLUMNS = `
  id,
  party_id,
  device_id,
  type,
  amount,
  note,
  occurred_at,
  created_at,
  deleted_at,
  deleted_by_device_id
`;

export class LedgerRepository {
  async create(
    values: CreateLedgerEntryValues
  ): Promise<PartyLedgerEntry> {
    const db = await getDatabase();

    await this.createWithDatabase(db, values);

    const entry = await this.getById(values.id);

    if (!entry) {
      throw new Error(
        'Ledger entry could not be loaded after creation'
      );
    }

    return entry;
  }

  async createWithDatabase(
    db: SQLiteDatabase,
    values: CreateLedgerEntryValues
  ): Promise<void> {
    if (
      !Number.isSafeInteger(values.amount) ||
      values.amount <= 0
    ) {
      throw new Error(
        'Ledger amount must be a positive integer'
      );
    }

    if (
      !['UDHAAR', 'SUPPLY', 'PAYMENT'].includes(
        values.type
      )
    ) {
      throw new Error('Invalid ledger entry type');
    }

    const party = await db.getFirstAsync<{
      type: string;
    }>(
      `
        SELECT type
        FROM parties
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      values.partyId
    );

    if (!party) {
      throw new Error('Active Party not found');
    }

    if (
      (values.type === 'UDHAAR' &&
        party.type !== 'CUSTOMER') ||
      (values.type === 'SUPPLY' &&
        party.type !== 'SUPPLIER')
    ) {
      throw new Error(
        'Ledger entry type does not match Party type'
      );
    }

    await db.runAsync(
      `
        INSERT INTO ledger_entries (
          id,
          party_id,
          device_id,
          type,
          amount,
          note,
          occurred_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values.id,
      values.partyId,
      values.deviceId,
      values.type,
      values.amount,
      values.note ?? null,
      values.occurredAt,
      values.createdAt
    );
  }

  async createUdhaarWithItems(
    values: CreateUdhaarWithItemsValues
  ): Promise<PartyLedgerEntry> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.createUdhaarWithItemsWithDatabase(
        db,
        values
      );
    });

    const entry = await this.getById(
      values.entry.id
    );

    if (!entry) {
      throw new Error(
        'Udhaar entry could not be loaded after creation'
      );
    }

    return entry;
  }

  async createUdhaarWithItemsWithDatabase(
    db: SQLiteDatabase,
    values: CreateUdhaarWithItemsValues
  ): Promise<void> {
    if (values.entry.type !== 'UDHAAR') {
      throw new Error(
        'This method only accepts UDHAAR entries'
      );
    }

    await this.createWithDatabase(
      db,
      values.entry
    );

    for (const item of values.items) {
      const name = item.name.trim();

      if (!name) {
        throw new Error(
          'Entry item name is required'
        );
      }

      if (name.length > 150) {
        throw new Error(
          'Entry item name cannot exceed 150 characters'
        );
      }

      const itemId =
        item.itemId?.trim() || null;

      const quantity =
        item.quantity ?? null;

      const unit =
        item.unit?.trim() || null;

      const unitPrice =
        item.unitPrice ?? null;

      const amount =
        item.amount ?? null;

      /*
       * Allow decimal quantities.
       * Missing quantity remains null.
       */
      if (
          quantity !== null &&
          !isValidSyncQuantity(quantity)
        ) {
          throw new Error(
            `Quantity for ${name} must be positive, ` +
            'have at most 3 decimal places, ' +
            'and be within the supported range'
          );
        }

      /*
       * A recorded quantity requires a unit.
       */
      if (
        quantity !== null &&
        unit === null
      ) {
        throw new Error(
          `Select a unit for ${name}`
        );
      }

      if (
        unit !== null &&
        unit.length > 30
      ) {
        throw new Error(
          `Unit for ${name} cannot exceed 30 characters`
        );
      }

      /*
       * Unit prices remain whole rupees.
       * Null is allowed when price is unknown.
       */
      if (
        unitPrice !== null &&
        (
          !Number.isSafeInteger(unitPrice) ||
          unitPrice < 0
        )
      ) {
        throw new Error(
          `Enter a valid selling price for ${name}`
        );
      }

      /*
       * Item amounts remain whole rupees.
       * Null preserves legacy name-only items.
       *
       * Do not enforce:
       * amount === quantity * unitPrice
       *
       * Amount-first entries may contain
       * approximate calculated quantities.
       */
      if (
        amount !== null &&
        (
          !Number.isSafeInteger(amount) ||
          amount <= 0
        )
      ) {
        throw new Error(
          `Enter a valid whole-rupee amount for ${name}`
        );
      }

      /*
       * Partial details without an amount are
       * not accepted. Legacy name-only rows
       * remain supported.
       */
      const hasDetails =
        quantity !== null ||
        unit !== null ||
        unitPrice !== null;

      if (
        amount === null &&
        hasDetails
      ) {
        throw new Error(
          `Enter an amount for ${name}`
        );
      }

      /*
       * SQLite schema v6 defines quantity TEXT.
       * Explicitly serialize decimal quantities.
       */
      const storedQuantity =
        quantity === null
          ? null
          : String(quantity);

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
        item.id,
        values.entry.id,
        itemId,
        name,
        amount,
        storedQuantity,
        unit,
        unitPrice
      );
    }
  }

  async getById(
    entryId: string
  ): Promise<PartyLedgerEntry | null> {
    const db = await getDatabase();

    return db.getFirstAsync<PartyLedgerEntry>(
      `
        SELECT ${ENTRY_COLUMNS}
        FROM ledger_entries
        WHERE id = ?
        LIMIT 1
      `,
      entryId
    );
  }

  async softDeleteWithDatabase(
    db: SQLiteDatabase,
    entryId: string,
    deviceId: string,
    deletedAt: string
  ): Promise<boolean> {
    const result = await db.runAsync(
      `
        UPDATE ledger_entries
        SET
          deleted_at = ?,
          deleted_by_device_id = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      deletedAt,
      deviceId,
      entryId
    );

    return result.changes === 1;
  }
}
