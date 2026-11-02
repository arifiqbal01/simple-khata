
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

import {
  isValidSyncQuantity,
} from '@/utils/ledger/quantity-precision';

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

    /*
     * Supply transactions belong only
     * to active suppliers in this shop.
     */
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

    /*
     * Normalize and validate every item
     * before beginning the write transaction.
     */
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

        const suppliedAmount =
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
          suppliedAmount !== null &&
          (
            !Number.isSafeInteger(suppliedAmount) ||
            suppliedAmount < 0
          )
        ) {
          throw new Error(
            'Item amount must be a non-negative whole number'
          );
        }

        /*
         * IMPORTANT:
         *
         * If the caller provides an amount,
         * it is authoritative.
         *
         * In Amount Mode, quantity may have
         * been rounded to three decimals.
         *
         * Therefore, do NOT require:
         *
         * quantity * unitPrice === amount
         */
        let amount = suppliedAmount;

        /*
         * Quantity-first fallback:
         *
         * If an amount was not supplied,
         * derive it once and round to
         * whole rupees.
         */
        if (
          amount === null &&
          quantity !== null &&
          unitPrice !== null
        ) {
          const calculatedAmount =
            Number(quantity) * unitPrice;

          if (
            !Number.isFinite(calculatedAmount) ||
            calculatedAmount < 0 ||
            calculatedAmount >
              Number.MAX_SAFE_INTEGER
          ) {
            throw new Error(
              `Invalid total for item "${name}"`
            );
          }

          amount = Math.round(
            calculatedAmount
          );

          if (!Number.isSafeInteger(amount)) {
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

    /*
     * Supply entries require a quantity,
     * unit price and amount for every item.
     *
     * The sum of authoritative line amounts
     * must equal the parent ledger amount.
     */
    let itemTotal = 0;

    for (const item of normalizedItems) {
      if (
        item.quantity === null ||
        item.unitPrice === null ||
        item.amount === null
      ) {
        throw new Error(
          'Complete all supply item details'
        );
      }

      const nextTotal =
        itemTotal + item.amount;

      if (!Number.isSafeInteger(nextTotal)) {
        throw new Error(
          'Supply item total exceeds the supported amount'
        );
      }

      itemTotal = nextTotal;
    }

    if (itemTotal !== input.amount) {
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
     * The ledger entry, item snapshots,
     * and outbox operation must commit
     * atomically.
     */
    await runWriteTransaction(async (db) => {
      /*
       * Verify that the supplier remains
       * active at the moment of writing.
       */
      const activeSupplier =
        await db.getFirstAsync<{
          id: string;
        }>(
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
       * Insert the parent ledger entry.
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
       * Store immutable item snapshots.
       *
       * Amount is not recalculated from
       * the approximate quantity.
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
       * Enqueue the same entry and item
       * snapshots in the sync outbox.
       *
       * Preserve the existing operation
       * type, payload structure and IDs.
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
     * The local transaction has committed.
     *
     * Network failure must never undo
     * the saved supply transaction.
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

/**
 * Normalize quantity to a string suitable
 * for SQLite snapshots and sync payloads.
 *
 * The backend accepts at most 3 fractional
 * decimal places and 12 total digits.
 */
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
    !isValidSyncQuantity(Number(quantity))
  ) {
    throw new Error(
      'Item quantity must be positive, within the supported range, and have at most 3 decimal places'
    );
  }

  /*
   * Canonicalize the number so a string
   * containing redundant trailing zeros
   * does not exceed backend precision.
   */
  const normalized = String(Number(quantity));

  if (
    !/^\d+(?:\.\d+)?$/.test(normalized)
  ) {
    throw new Error(
      'Invalid item quantity'
    );
  }

  return normalized;
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
