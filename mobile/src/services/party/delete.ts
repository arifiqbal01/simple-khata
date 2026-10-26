
import * as Crypto from 'expo-crypto';

import { runWriteTransaction } from '@/db/write-transaction';

import { PartyRepository } from '@/repositories/party/party';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { requestSync } from '@/services/sync/sync-coordinator';

export interface DeletePartyInput {
  shopId: string;
  deviceId: string;
  partyId: string;
}

export class DeletePartyService {
  constructor(
    private readonly repository: PartyRepository,
    private readonly syncOutboxRepository: SyncOutboxRepository
  ) {}

  async execute(
    input: DeletePartyInput
  ): Promise<boolean> {
    const shopId = input.shopId.trim();
    const deviceId = input.deviceId.trim();
    const partyId = input.partyId.trim();

    if (!shopId) {
      throw new Error('Shop ID is required');
    }

    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    if (!partyId) {
      throw new Error('Party ID is required');
    }

    const deletedAt = new Date().toISOString();
    const operationId = Crypto.randomUUID();

    /*
     * Party soft deletion and outbox enqueue
     * must commit or roll back together.
     *
     * The shared write coordinator prevents
     * overlapping application write transactions.
     */
    const deleted = await runWriteTransaction(
      async (db): Promise<boolean> => {
        /*
         * The repository only soft-deletes an
         * active Party belonging to this shop.
         */
        const wasDeleted =
          await this.repository.softDeleteWithDatabase(
            db,
            {
              id: partyId,
              shopId,
              deviceId,
              deletedAt,
            }
          );

        /*
         * If the Party does not exist or was
         * already deleted, do not enqueue
         * another PARTY_DELETE operation.
         */
        if (!wasDeleted) {
          return false;
        }

        /*
         * Enqueue deletion in the same transaction.
         * A failed enqueue rolls back the deletion.
         */
        await this.syncOutboxRepository.enqueueWithDatabase(
          db,
          {
            id: operationId,
            shopId,
            deviceId,

            operationType: 'PARTY_DELETE',
            entityType: 'PARTY',
            entityId: partyId,

            payload: {
              partyId,
              shopId,
              deletedAt,
              deletedByDeviceId: deviceId,
            },

            createdAt: deletedAt,
          }
        );

        return true;
      }
    );

    if (!deleted) {
      return false;
    }

    /*
     * The local transaction has committed.
     *
     * Sync is best-effort and must not cause
     * a successful local deletion to fail.
     */
    void requestSync().catch((error) => {
      console.warn(
        '[sync-trigger] party-delete failed',
        error
      );
    });

    return true;
  }
}
