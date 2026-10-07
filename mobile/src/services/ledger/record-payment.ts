import { getDatabase } from '@/db/database';
import { CustomerRepository } from '@/repositories/customer';
import { LedgerRepository } from '@/repositories/ledger';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { LedgerEntry } from '@/types/domain';

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
      id: crypto.randomUUID(),
      customerId: input.customerId,
      deviceId: input.deviceId,
      type: 'PAYMENT',
      amount: input.amount,
      note: null,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
    };

    const operationId = crypto.randomUUID();

    const db = await getDatabase();

    /*
     * Ledger mutation + outbox operation must be committed
     * atomically before any network sync is attempted.
     */
    await db.withTransactionAsync(async () => {
      await this.ledgerRepository.createWithDatabase(
        db,
        entry
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
            entry,
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