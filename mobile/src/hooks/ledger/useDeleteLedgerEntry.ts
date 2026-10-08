
import { useCallback, useState } from 'react';

import type {
  LedgerHistoryEntry,
} from '@/repositories/ledger';

import { LocalIdentityRepository } from '@/repositories/local-identity';

import { deleteLedgerEntry } from '@/services/ledger/deleteLedgerEntry';

const localIdentityRepository =
  new LocalIdentityRepository();

export interface UseDeleteLedgerEntryInput {
  shopId: string | null;
  onDeleted: () => Promise<void>;
}

export interface UseDeleteLedgerEntryResult {
  deleteEntry: (
    entry: LedgerHistoryEntry
  ) => Promise<void>;

  isDeleting: boolean;
  deletingEntryId: string | null;
}

export function useDeleteLedgerEntry({
  shopId,
  onDeleted,
}: UseDeleteLedgerEntryInput): UseDeleteLedgerEntryResult {
  const [deletingEntryId, setDeletingEntryId] =
    useState<string | null>(null);

  const deleteEntry = useCallback(
    async (entry: LedgerHistoryEntry): Promise<void> => {
      if (deletingEntryId !== null) {
        return;
      }

      if (!shopId) {
        throw new Error('Shop is not initialized');
      }

      setDeletingEntryId(entry.id);

      try {
        const identity =
          await localIdentityRepository.get();

        if (!identity) {
          throw new Error(
            'Device identity not found'
          );
        }

        if (identity.shopId !== shopId) {
          throw new Error(
            'Device identity does not match this shop'
          );
        }

        console.log(
          '[ledger-delete] deleting entry',
          entry.id
        );

        const deleted = await deleteLedgerEntry({
          shopId,
          deviceId: identity.deviceId,
          entryId: entry.id,
        });

        if (deleted) {
          console.log(
            '[ledger-delete] entry deleted locally',
            entry.id
          );
        } else {
          console.log(
            '[ledger-delete] entry already deleted',
            entry.id
          );
        }

        // Reload even if the entry was already deleted,
        // so history and balance reflect the current DB state.
        await onDeleted();
      } catch (error) {
        console.error(
          '[ledger-delete] failed',
          error
        );

        throw error;
      } finally {
        setDeletingEntryId(null);
      }
    },
    [shopId, onDeleted, deletingEntryId]
  );

  return {
    deleteEntry,
    isDeleting: deletingEntryId !== null,
    deletingEntryId,
  };
}
