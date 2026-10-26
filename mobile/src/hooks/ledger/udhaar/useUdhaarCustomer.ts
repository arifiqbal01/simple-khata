
import { useEffect, useState } from 'react';

import { PartyRepository } from '@/repositories/party/party';
import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import type {
  CustomerParty,
  UdhaarCustomerState,
} from './types';

const partyRepository = new PartyRepository();
const ledgerSummaryRepository =
  new LedgerSummaryRepository();
const identityRepository =
  new LocalIdentityRepository();

export function useUdhaarCustomer(
  customerId?: string
): UdhaarCustomerState {
  const [shopId, setShopId] = useState<string | null>(
    null
  );
  const [deviceId, setDeviceId] = useState<string | null>(
    null
  );
  const [customer, setCustomer] =
    useState<CustomerParty | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError(null);
      setShopId(null);
      setDeviceId(null);
      setCustomer(null);
      setBalance(0);

      try {
        if (!customerId) {
          throw new Error('Customer ID is missing');
        }

        const identity =
          await identityRepository.get();

        if (!identity) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        const currentCustomer =
          await partyRepository.getByIdAndShop(
            customerId,
            identity.shopId
          );

        if (
          !currentCustomer ||
          currentCustomer.type !== 'CUSTOMER'
        ) {
          throw new Error('Customer not found');
        }

        const currentBalance =
          await ledgerSummaryRepository.getCustomerBalance(
            identity.shopId,
            customerId
          );

        if (cancelled) return;

        setShopId(identity.shopId);
        setDeviceId(identity.deviceId);
        setCustomer(currentCustomer);
        setBalance(currentBalance);
      } catch (cause) {
        if (cancelled) return;

        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load customer'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return {
    shopId,
    deviceId,
    customer,
    balance,
    loading,
    error,
  };
}
