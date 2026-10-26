
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';

import { PartyRepository } from '@/repositories/party/party';

import {
  LedgerRepository,
  type PartyLedgerEntry,
} from '@/repositories/ledger/ledger';

import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { requestSync } from '@/services/sync/sync-coordinator';

export type PaymentPartyType = 'CUSTOMER' | 'SUPPLIER';

export interface RecordPaymentInput {
  shopId: string;
  partyId: string;
  deviceId: string;
  amount: number;
  occurredAt?: string;
  partyType?: PaymentPartyType;
}

export class RecordPaymentService {
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly partyRepository: PartyRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: RecordPaymentInput
  ): Promise<PartyLedgerEntry> {
    const shopId = input.shopId.trim();
    const partyId = input.partyId.trim();
    const deviceId = input.deviceId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!partyId) {
      throw new Error('Party ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    validateAmount(input.amount);

    /*
     * Verify that the party belongs to this shop.
     * Payments are supported for both customers
     * and suppliers.
     */
    const party =
      await this.partyRepository.getByIdAndShop(
        partyId,
        shopId
      );

    if (!party) {
      throw new Error('Customer or supplier not found');
    }

    if (
      party.type !== 'CUSTOMER' &&
      party.type !== 'SUPPLIER'
    ) {
      throw new Error('Invalid party type');
    }

    if (
      input.partyType &&
      party.type !== input.partyType
    ) {
      throw new Error(
        `Expected ${input.partyType.toLowerCase()} but found ${party.type.toLowerCase()}`
      );
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
      type: 'PAYMENT',
      amount: input.amount,
      note: null,
      occurred_at: occurredAt,
      created_at: now,
      deleted_at: null,
      deleted_by_device_id: null,
    };

    const operationId = Crypto.randomUUID();

    /*
     * Commit the payment and sync operation
     * together in the local database.
     */
    await runWriteTransaction(async (db) => {
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

      await this.syncOutboxRepository.enqueueWithDatabase(
        db,
        {
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
            items: [],
          },
          createdAt: now,
        }
      );
    });

    /*
     * Local save is complete.
     * Sync failures must not undo the payment.
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
