import { getDatabase } from '@/db/database';
import { CustomerRepository } from '@/repositories/customer';
import {
  LedgerRepository,
  type CreateUdhaarItemValues,
} from '@/repositories/ledger';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import type { LedgerEntry } from '@/types/domain';

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
        id: crypto.randomUUID(),
        itemId: item.itemId ?? null,
        name,
      };
    });

    const now = new Date().toISOString();

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      customerId: input.customerId,
      deviceId: input.deviceId,
      type: 'UDHAAR',
      amount: input.amount,
      note: input.note?.trim() || null,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
    };

    const operationId = crypto.randomUUID();

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.ledgerRepository
        .createUdhaarWithItemsWithDatabase(
          db,
          {
            entry,
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
            entry,
            items: normalizedItems,
          },

          createdAt: now,
        });
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