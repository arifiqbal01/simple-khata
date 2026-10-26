
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';

import { PartyRepository } from '@/repositories/party/party';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { requestSync } from '@/services/sync/sync-coordinator';

import type { Party, PartyType } from '@/types/domain';

export interface CreatePartyInput {
  shopId: string;
  deviceId: string;
  type: PartyType;
  name: string;
  phone?: string | null;
}

export class CreatePartyService {
  constructor(
    private readonly repository: PartyRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: CreatePartyInput
  ): Promise<Party> {
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    if (
      input.type !== 'CUSTOMER' &&
      input.type !== 'SUPPLIER'
    ) {
      throw new Error('Invalid party type');
    }

    const name = input.name.trim();

    if (!name) {
      throw new Error('Party name is required');
    }

    if (name.length > 150) {
      throw new Error(
        'Party name cannot be longer than 150 characters'
      );
    }

    const phone = normalizePhone(input.phone);

    if (phone && phone.length > 30) {
      throw new Error(
        'Party phone cannot exceed 30 characters'
      );
    }

    const now = new Date().toISOString();

    const party: Party = {
      id: Crypto.randomUUID(),
      shop_id: shopId,
      type: input.type,
      name,
      phone,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      deleted_by_device_id: null,
    };

    const operationId = Crypto.randomUUID();

    /*
     * Party creation and sync outbox enqueue
     * must commit or roll back together.
     *
     * Do not make network requests inside
     * this transaction.
     */
    await runWriteTransaction(async (db) => {
      await this.repository.createWithDatabase(
        db,
        {
          id: party.id,
          shopId: party.shop_id,
          type: party.type,
          name: party.name,
          phone: party.phone,
          createdAt: party.created_at,
          updatedAt: party.updated_at,
        }
      );

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
          id: operationId,
          shopId,
          deviceId,

          operationType: 'PARTY_CREATE',
          entityType: 'PARTY',
          entityId: party.id,

          payload: {
            party: {
              id: party.id,
              shopId: party.shop_id,
              type: party.type,
              name: party.name,
              phone: party.phone,
              createdAt: party.created_at,
              updatedAt: party.updated_at,
            },
          },

          createdAt: now,
        }
      );
    });

    /*
     * Local creation has committed.
     *
     * Sync is best-effort. A network failure
     * must not invalidate a successful local write.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] party-create failed',
        error
      );
    });

    return party;
  }
}

/**
 * Normalize common Pakistani phone formats.
 *
 * Examples:
 * 03012345678   -> +923012345678
 * 923012345678  -> +923012345678
 * +923012345678 -> +923012345678
 *
 * Other formats are preserved after removing
 * whitespace, hyphens and parentheses.
 */
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

  // Pakistani mobile: 03012345678
  if (
    normalized.startsWith('03') &&
    normalized.length === 11
  ) {
    return `+92${normalized.slice(1)}`;
  }

  // Pakistani mobile: 923012345678
  if (
    normalized.startsWith('923') &&
    normalized.length === 12
  ) {
    return `+${normalized}`;
  }

  return normalized;
}
