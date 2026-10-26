
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';

import { PartyRepository } from '@/repositories/party/party';

import {
  LedgerRepository,
  type PartyLedgerEntry,
} from '@/repositories/ledger/ledger';

import {
  SyncOutboxRepository,
  syncOutboxRepository,
} from '@/repositories/sync/sync-outbox';

import { requestSync } from '@/services/sync/sync-coordinator';

export interface CreateSupplyItemInput {
  itemId?: string | null;
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount?: number | null;
}

export interface CreateSupplyInput {
  shopId: string;
  partyId: string;
  deviceId: string;
  amount: number;
  note?: string | null;
  occurredAt?: string;
  items?: CreateSupplyItemInput[];
}

interface NormalizedSupplyItem {
  id: string;
  itemId: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number | null;
}

export class CreateSupplyService {
  constructor(
    private readonly ledgerRepository =
      new LedgerRepository(),
    private readonly partyRepository =
      new PartyRepository(),
    private readonly outboxRepository:
      SyncOutboxRepository = syncOutboxRepository
  ) {}

  async execute(
    input: CreateSupplyInput
  ): Promise<PartyLedgerEntry> {
    const shopId = input.shopId?.trim();
    const partyId = input.partyId?.trim();
    const deviceId = input.deviceId?.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!partyId) {
      throw new Error('Supplier ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    validateAmount(input.amount);

    // Supply entries must belong to a supplier.
    const supplier =
      await this.partyRepository.getByIdAndShop(
        partyId,
        shopId
      );

    if (
      !supplier ||
      supplier.type !== 'SUPPLIER'
    ) {
      throw new Error('Supplier not found');
    }

    const normalizedItems: NormalizedSupplyItem[] =
      (input.items ?? []).map((item) => {
        const name = item.name.trim();

        const itemId =
          item.itemId?.trim() || null;

        const quantity =
          normalizeQuantity(item.quantity);

        const unit =
          item.unit?.trim() || null;

        if (!name) {
          throw new Error(
            'Item name is required'
          );
        }

        if (name.length > 150) {
          throw new Error(
            'Item name cannot exceed 150 characters'
          );
        }

        if (unit && unit.length > 30) {
          throw new Error(
            'Item unit cannot exceed 30 characters'
          );
        }

        const unitPrice =
          item.unitPrice ?? null;

        const amount =
          item.amount ?? null;

        if (
          unitPrice !== null &&
          (
            !Number.isSafeInteger(unitPrice) ||
            unitPrice < 0
          )
        ) {
          throw new Error(
            'Item unit price must be a non-negative whole number'
          );
        }

        if (
          amount !== null &&
          (
            !Number.isSafeInteger(amount) ||
            amount < 0
          )
        ) {
          throw new Error(
            'Item amount must be a non-negative whole number'
          );
        }

        if (
          quantity !== null &&
          unitPrice !== null &&
          amount !== null
        ) {
          const calculatedAmount =
            Number(quantity) * unitPrice;

          if (
            !Number.isSafeInteger(calculatedAmount) ||
            calculatedAmount !== amount
          ) {
            throw new Error(
              `Invalid total for item "${name}"`
            );
          }
        }

        return {
          id: Crypto.randomUUID(),
          itemId,
          name,
          quantity,
          unit,
          unitPrice,
          amount,
        };
      });

    if (normalizedItems.length === 0) {
      throw new Error(
        'Add at least one supply item'
      );
    }

    const itemTotal =
      normalizedItems.reduce(
        (total, item) =>
          total + (item.amount ?? 0),
        0
      );

    if (
      normalizedItems.some(
        (item) =>
          item.quantity === null ||
          item.unitPrice === null ||
          item.amount === null
      ) ||
      !Number.isSafeInteger(itemTotal) ||
      itemTotal !== input.amount
    ) {
      throw new Error(
        'Supply item totals do not match the transaction amount'
      );
    }

    const now = new Date().toISOString();

    const occurredAt =
      input.occurredAt ?? now;

    if (
      !occurredAt.trim() ||
      Number.isNaN(Date.parse(occurredAt))
    ) {
      throw new Error(
        'Invalid occurrence date'
      );
    }

    const entry: PartyLedgerEntry = {
      id: Crypto.randomUUID(),
      party_id: partyId,
      device_id: deviceId,
      type: 'SUPPLY',
      amount: input.amount,
      note: input.note ?? null,
      occurred_at: occurredAt,
      created_at: now,
      deleted_at: null,
      deleted_by_device_id: null,
    };

    const operationId = Crypto.randomUUID();

    /*
     * Commit the ledger entry, item snapshots,
     * and sync outbox operation atomically.
     */
    await runWriteTransaction(async (db) => {
      /*
       * Verify that the supplier is still active
       * before writing the transaction.
       */
      const activeSupplier =
        await db.getFirstAsync<{ id: string }>(
          `
            SELECT id
            FROM parties
            WHERE id = ?
              AND shop_id = ?
              AND type = 'SUPPLIER'
              AND deleted_at IS NULL
            LIMIT 1
          `,
          partyId,
          shopId
        );

      if (!activeSupplier) {
        throw new Error(
          'Supplier not found'
        );
      }

      /*
       * Insert the main ledger entry.
       */
      await this.ledgerRepository.createWithDatabase(
        db,
        {
          id: entry.id,
          partyId: entry.party_id,
          deviceId: entry.device_id,
          type: entry.type,
          amount: entry.amount,
          note: entry.note,
          occurredAt: entry.occurred_at,
          createdAt: entry.created_at,
        }
      );

      /*
       * Save item snapshots independently
       * of catalog names and prices.
       */
      for (const item of normalizedItems) {
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
          entry.id,
          item.itemId,
          item.name,
          item.amount,
          item.quantity,
          item.unit,
          item.unitPrice
        );
      }

      /*
       * Queue the same entry and item snapshots
       * for synchronization.
       */
      await this.outboxRepository.enqueueWithDatabase(
        db,
        {
          id: operationId,
          shopId,
          deviceId,

          operationType:
            'LEDGER_ENTRY_CREATE',

          entityType: 'LEDGER_ENTRY',
          entityId: entry.id,

          payload: {
            entry: {
              id: entry.id,
              partyId: entry.party_id,
              deviceId: entry.device_id,
              type: entry.type,
              amount: entry.amount,
              note: entry.note,
              occurredAt: entry.occurred_at,
              createdAt: entry.created_at,
            },

            items: normalizedItems.map(
              (item) => ({
                id: item.id,
                ledgerEntryId: entry.id,
                itemId: item.itemId,
                itemName: item.name,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                amount: item.amount,
                createdAt: now,
              })
            ),
          },

          createdAt: now,
        }
      );
    });

    /*
     * The local transaction is now committed.
     * Network errors must not undo the save.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] supply-create failed',
        error
      );
    });

    return entry;
  }
}

function normalizeQuantity(
  value: number | string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const quantity = String(value).trim();

  if (!quantity) {
    return null;
  }

  if (
    !/^\d+(?:\.\d+)?$/.test(quantity) ||
    !Number.isFinite(Number(quantity)) ||
    Number(quantity) <= 0
  ) {
    throw new Error(
      'Item quantity must be greater than zero'
    );
  }

  return quantity;
}

function validateAmount(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new Error(
      'Supply amount must be a whole number'
    );
  }

  if (amount <= 0) {
    throw new Error(
      'Supply amount must be greater than zero'
    );
  }
}
