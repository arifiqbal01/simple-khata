
import {
  useCallback,
  useRef,
  useState,
} from 'react';

import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import { deleteLedgerEntry } from '@/services/ledger/deleteLedgerEntry';

const localIdentityRepository =
  new LocalIdentityRepository();

/**
 * Ledger deletion only requires the entry ID.
 *
 * This allows customer and supplier ledger
 * entries to use the same deletion hook.
 */
export interface DeletableLedgerEntry {
  id: string;
}

export interface UseDeleteLedgerEntryInput {
  shopId: string | null;
  onDeleted: () => Promise<void>;
}

export interface UseDeleteLedgerEntryResult {
  deleteEntry: (
    entry: DeletableLedgerEntry
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

  const deletingRef = useRef(false);

  const deleteEntry = useCallback(
    async (
      entry: DeletableLedgerEntry
    ): Promise<void> => {
      // Prevent concurrent deletion requests.
      if (deletingRef.current) {
        return;
      }

      if (!shopId) {
        throw new Error(
          'Shop is not initialized'
        );
      }

      if (!entry.id) {
        throw new Error(
          'Ledger entry ID is missing'
        );
      }

      deletingRef.current = true;
      setDeletingEntryId(entry.id);

      try {
        // Verify the current device identity.
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
          '[ledger-delete] Deleting entry:',
          entry.id
        );

        // Delete locally and enqueue sync operation
        // through the existing deletion service.
        const deleted =
          await deleteLedgerEntry({
            shopId,
            deviceId: identity.deviceId,
            entryId: entry.id,
          });

        if (deleted) {
          console.log(
            '[ledger-delete] Entry deleted locally:',
            entry.id
          );
        } else {
          console.log(
            '[ledger-delete] Entry already deleted:',
            entry.id
          );
        }

        // Refresh ledger and balance even if
        // the entry was already deleted.
        await onDeleted();
      } catch (error) {
        console.error(
          '[ledger-delete] Failed:',
          error
        );

        throw error;
      } finally {
        deletingRef.current = false;
        setDeletingEntryId(null);
      }
    },
    [shopId, onDeleted]
  );

  return {
    deleteEntry,
    isDeleting: deletingEntryId !== null,
    deletingEntryId,
  };
}
