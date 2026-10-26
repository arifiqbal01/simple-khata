
import { useCallback, useRef, useState } from 'react';

import { PartyRepository } from '@/repositories/party/party';
import { SyncOutboxRepository } from '@/repositories/sync/sync-outbox';
import { DeletePartyService } from '@/services/party/delete';

import type { PartyRowData } from '@/components/party/PartyRow';

const deletePartyService = new DeletePartyService(
  new PartyRepository(),
  new SyncOutboxRepository()
);

export interface UseDeletePartyInput {
  shopId: string | null;
  deviceId: string | null;
  onDeleted: () => void | Promise<void>;
}

export function useDeleteParty({
  shopId,
  deviceId,
  onDeleted,
}: UseDeletePartyInput) {
  const [partyToDelete, setPartyToDelete] =
    useState<PartyRowData | null>(null);

  const [deletingPartyId, setDeletingPartyId] =
    useState<string | null>(null);

  const [deleteError, setDeleteError] =
    useState<string | null>(null);

  const deletingRef = useRef(false);

  const confirmDeleteParty = useCallback(
    (party: PartyRowData) => {
      if (deletingRef.current) return;

      setDeleteError(null);
      setPartyToDelete(party);
    },
    []
  );

  const cancelDeleteParty = useCallback(() => {
    if (deletingRef.current) return;

    setPartyToDelete(null);
  }, []);

  const executeDeleteParty = useCallback(async () => {
    if (deletingRef.current || !partyToDelete) {
      return;
    }

    if (!shopId || !deviceId) {
      setDeleteError('Shop or device is not initialized');
      setPartyToDelete(null);
      return;
    }

    deletingRef.current = true;
    setDeletingPartyId(partyToDelete.id);
    setDeleteError(null);

    try {
      const deleted = await deletePartyService.execute({
        shopId,
        deviceId,
        partyId: partyToDelete.id,
      });

      if (!deleted) {
        throw new Error(
          'Party was not found or was already deleted'
        );
      }

      setPartyToDelete(null);

      await onDeleted();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Could not delete party'
      );

      setPartyToDelete(null);
    } finally {
      deletingRef.current = false;
      setDeletingPartyId(null);
    }
  }, [shopId, deviceId, partyToDelete, onDeleted]);

  return {
    partyToDelete,
    deletingPartyId,
    deleteError,
    confirmDeleteParty,
    cancelDeleteParty,
    executeDeleteParty,
  };
}
