
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';

import { PartyRepository } from '@/repositories/party/party';

import {
  LedgerRepository,
  type CreateUdhaarItemValues,
  type PartyLedgerEntry,
} from '@/repositories/ledger/ledger';

import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { requestSync } from '@/services/sync/sync-coordinator';

export interface CreateUdhaarItemInput {
  itemId?: string | null;
  name: string;

  // Whole rupees. Authoritative when supplied.
  amount?: number | null;

  // Positive decimal quantities are supported.
  quantity?: number | null;

  unit?: string | null;

  // Whole rupees per unit.
  unitPrice?: number | null;
}

export interface CreateUdhaarInput {
  shopId: string;
  partyId: string;
  deviceId: string;
  amount: number;
  note?: string | null;
  occurredAt?: string;
  items?: CreateUdhaarItemInput[];
}

function validateAmount(amount: number): void {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Udhaar amount must be a positive whole number'
    );
  }
}

function normalizeUdhaarItem(
  item: CreateUdhaarItemInput
): CreateUdhaarItemValues {
  const name = item.name.trim();

  if (!name) {
    throw new Error('Item name is required');
  }

  if (name.length > 150) {
    throw new Error(
      'Item name cannot exceed 150 characters'
    );
  }

  const itemId = item.itemId?.trim() || null;

  const quantity = item.quantity ?? null;
  const unit = item.unit?.trim() || null;
  const unitPrice = item.unitPrice ?? null;
  const suppliedAmount = item.amount ?? null;

  if (
    quantity !== null &&
    (
      !Number.isFinite(quantity) ||
      quantity <= 0
    )
  ) {
    throw new Error(
      `Enter a valid positive quantity for ${name}`
    );
  }

  if (unit !== null && unit.length > 30) {
    throw new Error(
      `Unit for ${name} cannot exceed 30 characters`
    );
  }

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

  if (
    suppliedAmount !== null &&
    (
      !Number.isSafeInteger(suppliedAmount) ||
      suppliedAmount <= 0
    )
  ) {
    throw new Error(
      `Enter a valid whole-rupee amount for ${name}`
    );
  }

  // A quantity must have a unit.
  if (quantity !== null && unit === null) {
    throw new Error(
      `Select a unit for ${name}`
    );
  }

  // Preserve legacy name-only item snapshots.
  const hasDetails =
    quantity !== null ||
    unit !== null ||
    unitPrice !== null ||
    suppliedAmount !== null;

  if (!hasDetails) {
    return {
      id: Crypto.randomUUID(),
      itemId,
      name,
      amount: null,
      quantity: null,
      unit: null,
      unitPrice: null,
    };
  }

  let amount = suppliedAmount;

  /*
   * If an amount was not supplied, calculate
   * it from quantity and price.
   *
   * Quantity-first rounds once per item line.
   */
  if (amount === null) {
    if (
      quantity === null ||
      unitPrice === null
    ) {
      throw new Error(
        `Enter an amount or quantity and price for ${name}`
      );
    }

    const calculated = quantity * unitPrice;

    if (
      !Number.isFinite(calculated) ||
      calculated < 0 ||
      calculated > Number.MAX_SAFE_INTEGER
    ) {
      throw new Error(
        `Line total for ${name} exceeds the supported amount`
      );
    }

    amount = Math.round(calculated);

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new Error(
        `Line total for ${name} must be at least one rupee`
      );
    }
  }

  /*
   * An explicitly supplied amount remains
   * authoritative.
   *
   * This supports:
   * - Amount-first with approximate quantity
   * - Amount-first with unknown quantity
   * - Quantity-first with rounded rupee total
   *
   * Do not enforce exact equality between
   * amount and quantity * unitPrice.
   */
  return {
    id: Crypto.randomUUID(),
    itemId,
    name,
    amount,
    quantity,
    unit,
    unitPrice,
  };
}

export class CreateUdhaarService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly partyRepository: PartyRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: CreateUdhaarInput
  ): Promise<PartyLedgerEntry> {
    const shopId = input.shopId.trim();
    const partyId = input.partyId.trim();
    const deviceId = input.deviceId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!partyId) {
      throw new Error('Customer ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    validateAmount(input.amount);

    /*
     * Customers and suppliers share the parties table.
     * Udhaar entries must belong to a CUSTOMER.
     */
    const customer =
      await this.partyRepository.getByIdAndShop(
        partyId,
        shopId
      );

    if (
      !customer ||
      customer.type !== 'CUSTOMER'
    ) {
      throw new Error('Customer not found');
    }

    /*
     * Normalize all item snapshots before beginning
     * the write transaction.
     *
     * Supports:
     * - Standalone amount-only Udhaar
     * - Legacy name-only items
     * - Amount-first itemized Udhaar
     * - Quantity-first itemized Udhaar
     */
    const normalizedItems =
      (input.items ?? []).map(normalizeUdhaarItem);

    /*
     * When every item has an amount, the sum must
     * exactly match the parent ledger amount.
     *
     * Legacy name-only entries retain their
     * previous behavior.
     */
    const allItemsItemized =
      normalizedItems.length > 0 &&
      normalizedItems.every(
        (item) => item.amount !== null
      );

    if (allItemsItemized) {
      const itemTotal = normalizedItems.reduce(
        (sum, item) => sum + (item.amount ?? 0),
        0
      );

      if (!Number.isSafeInteger(itemTotal)) {
        throw new Error(
          'Total Udhaar amount exceeds the supported amount'
        );
      }

      if (itemTotal !== input.amount) {
        throw new Error(
          'Udhaar amount must match the total of selected items'
        );
      }
    }

    const now = new Date().toISOString();
    const occurredAt = input.occurredAt ?? now;

    if (
      !occurredAt.trim() ||
      Number.isNaN(Date.parse(occurredAt))
    ) {
      throw new Error('Invalid occurrence date');
    }

    const entry: PartyLedgerEntry = {
      id: Crypto.randomUUID(),
      party_id: partyId,
      device_id: deviceId,
      type: 'UDHAAR',
      amount: input.amount,
      note: input.note ?? null,
      occurred_at: occurredAt,
      created_at: now,
      deleted_at: null,
      deleted_by_device_id: null,
    };

    /*
     * Keep item snapshots in the sync payload.
     * Missing details remain null.
     */
    const syncItems = normalizedItems.map((item) => ({
      id: item.id,
      ledgerEntryId: entry.id,
      itemId: item.itemId,
      itemName: item.name,
      amount: item.amount ?? null,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      unitPrice: item.unitPrice ?? null,
      createdAt: now,
    }));

    const operationId = Crypto.randomUUID();

    /*
     * Preserve the existing atomic write:
     *
     * 1. Ledger entry
     * 2. Entry item snapshots
     * 3. Sync outbox operation
     */
    await runWriteTransaction(async (db) => {
      await this.ledgerRepository
        .createUdhaarWithItemsWithDatabase(
          db,
          {
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
            items: normalizedItems,
          }
        );

      await this.syncOutboxRepository
        .enqueueWithDatabase(db, {
          id: operationId,
          shopId,
          deviceId,

          operationType: 'LEDGER_ENTRY_CREATE',
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
            items: syncItems,
          },

          createdAt: now,
        });
    });

    /*
     * Sync after the local transaction commits.
     * A sync failure must not undo the local save.
     */
    void requestSync().catch((error: unknown) => {
      console.warn(
        '[sync-trigger] udhaar-create failed',
        error
      );
    });

    return entry;
  }
}
