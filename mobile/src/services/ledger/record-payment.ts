import { getDatabase } from '@/db/database';
import { CustomerRepository } from '@/repositories/customer';
import { LedgerRepository } from '@/repositories/ledger';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { LedgerEntry } from '@/types/domain';
import * as Crypto from 'expo-crypto';

export interface RecordPaymentInput {
  shopId: string;
  customerId: string;
  deviceId: string;
  amount: number;
  occurredAt?: string;
}

export class RecordPaymentService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: RecordPaymentInput
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

    const now = new Date().toISOString();

    const entry: LedgerEntry = {
      id: Crypto.randomUUID(),
      customer_id: input.customerId,
      device_id: input.deviceId,
      type: 'PAYMENT',
      amount: input.amount,
      note: null,
      occurred_at: input.occurredAt ?? now,
      created_at: now,
    };

    const operationId = Crypto.randomUUID();

    const db = await getDatabase();

    /*
     * Ledger mutation + outbox operation must be committed
     * atomically before any network sync is attempted.
     */
    await db.withTransactionAsync(async () => {
      await this.ledgerRepository.createWithDatabase(
        db,
        {
          id: entry.id,
          customerId: entry.customer_id,
          deviceId: entry.device_id,
          type: entry.type,
          amount: entry.amount,
          note: entry.note,
          occurredAt: entry.occurred_at,
          createdAt: entry.created_at,
        }
      );

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
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
              items: [],
            },

          createdAt: now,
        }
      );
    });

    /*
     * Local payment is committed.
     *
     * Sync is fire-and-forget so an offline/network failure
     * never causes the successful local payment to fail.
     * The outbox remains available for a later reconnect,
     * foreground, startup, or manual sync.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] payment-create failed',
        error
      );
    });

    return entry;
  }
}

function validateAmount(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new Error(
      'Payment amount must be a whole number'
    );
  }

  if (amount <= 0) {
    throw new Error(
      'Payment amount must be greater than zero'
    );
  }
}