import { getDatabase } from '@/db/database';
import { CustomerRepository } from '@/repositories/customer';
import { SyncOutboxRepository } from '@/repositories/sync-outbox';
import { requestSync } from '@/services/sync/sync-coordinator';
import type { Customer } from '@/types/domain';
import * as Crypto from 'expo-crypto';

export interface CreateCustomerInput {
  shopId: string;
  deviceId: string;
  name: string;
  phone?: string | null;
}

export class CreateCustomerService {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: CreateCustomerInput
  ): Promise<Customer> {
    const name = input.name.trim();

    if (!name) {
      throw new Error('Customer name is required');
    }

    if (name.length > 150) {
      throw new Error(
        'Customer name cannot be longer than 150 characters'
      );
    }

    const phone = normalizePhone(input.phone);

    const now = new Date().toISOString();

    /*
     * Domain objects use snake_case because they match
     * the SQLite/API representation.
     */
    const customer: Customer = {
      id: Crypto.randomUUID(),
      shop_id: input.shopId,
      name,
      phone,
      created_at: now,
      updated_at: now,
    };

    const operationId = Crypto.randomUUID();

    const db = await getDatabase();

    /*
     * Local mutation + outbox enqueue must remain atomic.
     */
    await db.withTransactionAsync(async () => {
      /*
       * Repository write inputs use camelCase.
       */
      await this.repository.createWithDatabase(
        db,
        {
          id: customer.id,
          shopId: customer.shop_id,
          name: customer.name,
          phone: customer.phone,
          createdAt: customer.created_at,
          updatedAt: customer.updated_at,
        }
      );

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: operationId,
          shopId: input.shopId,
          deviceId: input.deviceId,

          operationType: 'CUSTOMER_CREATE',
          entityType: 'CUSTOMER',
          entityId: customer.id,

          payload: {
              customer: {
                id: customer.id,
                shopId: customer.shop_id,
                name: customer.name,
                phone: customer.phone,
                createdAt: customer.created_at,
                updatedAt: customer.updated_at,
              },
            },

          createdAt: now,
        }
      );
    });

    /*
     * Local transaction has completed successfully.
     *
     * Request sync without awaiting it. Network/sync failure
     * must never turn a successful local mutation into a
     * failed customer creation.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] customer-create failed',
        error
      );
    });

    return customer;
  }
}

function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) {
    return null;
  }

  const normalized = phone
    .trim()
    .replace(/\s/g, '')
    .replace(/-/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');

  if (!normalized) {
    return null;
  }

  // Pakistani mobile:
  // 03012345678 -> +923012345678
  if (
    normalized.startsWith('03') &&
    normalized.length === 11
  ) {
    return `+92${normalized.slice(1)}`;
  }

  // 923012345678 -> +923012345678
  if (
    normalized.startsWith('923') &&
    normalized.length === 12
  ) {
    return `+${normalized}`;
  }

  return normalized;
}