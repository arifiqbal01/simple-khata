
import { runWriteTransaction } from '@/db/write-transaction';
import { CustomerRepository } from '@/repositories/customer';
import {
  LedgerRepository,
  type CreateUdhaarItemValues,
} from '@/repositories/ledger';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { LedgerEntry } from '@/types/domain';
import * as Crypto from 'expo-crypto';

export interface CreateUdhaarItemInput {
  itemId?: string | null;
  name: string;
}

export interface CreateUdhaarInput {
  shopId: string;
  customerId: string;
  deviceId: string;
  amount: number;
  note?: string | null;
  occurredAt?: string;
  items?: CreateUdhaarItemInput[];
}

export class CreateUdhaarService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: CreateUdhaarInput
  ): Promise<LedgerEntry> {
    validateAmount(input.amount);

    const customer =
      await this.customerRepository.getByIdAndShop(
        input.customerId,
        input.shopId
      );

    if (!customer) {
      throw new Error('Customer not found');
    }

    const normalizedItems: CreateUdhaarItemValues[] = (
      input.items ?? []
    ).map((item) => {
      const name = item.name.trim();

      if (!name) {
        throw new Error('Item name is required');
      }

      if (name.length > 150) {
        throw new Error(
          'Item name cannot be longer than 150 characters'
        );
      }

      return {
        id: Crypto.randomUUID(),
        itemId: item.itemId ?? null,
        name,
      };
    });

    const now = new Date().toISOString();
    const occurredAt = input.occurredAt ?? now;

    const entry: LedgerEntry = {
      id: Crypto.randomUUID(),
      customer_id: input.customerId,
      device_id: input.deviceId,
      type: 'UDHAAR',
      amount: input.amount,
      note: input.note ?? null,
      occurred_at: occurredAt,
      created_at: now,
      deleted_at: null,
      deleted_by_device_id: null,
    };

    /*
     * Local SQLite and sync API intentionally use
     * different representations for ledger-entry items.
     */
    const syncItems = normalizedItems.map((item) => ({
      id: item.id,
      ledgerEntryId: entry.id,
      itemId: item.itemId,
      itemName: item.name,
      createdAt: now,
    }));

    const operationId = Crypto.randomUUID();

    /*
     * Domain mutation + outbox enqueue are one atomic
     * local transaction.
     *
     * The shared coordinator prevents overlap with
     * other transactions using runWriteTransaction().
     */
    await runWriteTransaction(async (db) => {
      await this.ledgerRepository
        .createUdhaarWithItemsWithDatabase(
          db,
          {
            entry: {
              id: entry.id,
              customerId: entry.customer_id,
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
          shopId: input.shopId,
          deviceId: input.deviceId,

          operationType: 'LEDGER_ENTRY_CREATE',
          entityType: 'LEDGER_ENTRY',
          entityId: entry.id,

          payload: {
            entry: {
              id: entry.id,
              customerId: entry.customer_id,
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
     * Transaction is committed at this point.
     *
     * Do not await sync. The local udhaar operation has
     * already succeeded and must remain successful even
     * when the device is offline.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] udhaar-create failed',
        error
      );
    });

    return entry;
  }
}

function validateAmount(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new Error(
      'Udhaar amount must be a whole number'
    );
  }

  if (amount <= 0) {
    throw new Error(
      'Udhaar amount must be greater than zero'
    );
  }
}
