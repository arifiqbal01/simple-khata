
import { useCallback, useRef, useState } from 'react';

import { PartyRepository } from '@/repositories/party/party';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';
import { syncOutboxRepository } from '@/repositories/sync/sync-outbox';

import { CreatePartyService } from '@/services/party/create';

export type PartyType = 'CUSTOMER' | 'SUPPLIER';

const partyRepository = new PartyRepository();
const localIdentityRepository = new LocalIdentityRepository();

const createPartyService = new CreatePartyService(
  partyRepository,
  syncOutboxRepository
);

export function useCreateParty(partyType: PartyType) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);

  const trimmedName = name.trim();

  const canSave =
    trimmedName.length > 0 &&
    !saving;

  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!trimmedName || savingRef.current) {
      return false;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const identity =
        await localIdentityRepository.get();

      if (!identity) {
        throw new Error(
          'Local installation identity not found'
        );
      }

      await createPartyService.execute({
        shopId: identity.shopId,
        deviceId: identity.deviceId,
        type: partyType,
        name: trimmedName,
        phone: phone.trim() || null,
      });

      resetForm();
      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    trimmedName,
    phone,
    partyType,
    resetForm,
  ]);

  return {
    name,
    setName,
    phone,
    setPhone,
    saving,
    canSave,
    save,
    resetForm,
  };
}
