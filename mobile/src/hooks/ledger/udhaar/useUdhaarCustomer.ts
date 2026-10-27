
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
  const [state, setState] =
    useState<UdhaarCustomerState>({
      shopId: null,
      deviceId: null,
      customer: null,
      balance: 0,
      loading: true,
      error: null,
    });

  useEffect(() => {
    let cancelled = false;

    setState({
      shopId: null,
      deviceId: null,
      customer: null,
      balance: 0,
      loading: true,
      error: null,
    });

    async function initialize() {
      try {
        if (!customerId) {
          throw new Error('Customer ID is missing');
        }

        /*
         * The local installation identity is the
         * authoritative source for shopId/deviceId.
         */
        const identity =
          await identityRepository.get();

        if (cancelled) {
          return;
        }

        if (
          !identity ||
          !identity.shopId ||
          !identity.deviceId
        ) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        /*
         * Ensure the customer belongs to the
         * current shop.
         */
        const currentCustomer =
          await partyRepository.getByIdAndShop(
            customerId,
            identity.shopId
          );

        if (cancelled) {
          return;
        }

        if (
          !currentCustomer ||
          currentCustomer.type !== 'CUSTOMER'
        ) {
          throw new Error('Customer not found');
        }

        /*
         * Read the balance from the local ledger.
         * This works offline.
         */
        const currentBalance =
          await ledgerSummaryRepository.getCustomerBalance(
            identity.shopId,
            customerId
          );

        if (cancelled) {
          return;
        }

        setState({
          shopId: identity.shopId,
          deviceId: identity.deviceId,
          customer: currentCustomer,
          balance: currentBalance,
          loading: false,
          error: null,
        });
      } catch (cause) {
        if (cancelled) {
          return;
        }

        console.warn(
          '[add-udhaar] Customer initialization failed:',
          cause
        );

        setState({
          shopId: null,
          deviceId: null,
          customer: null,
          balance: 0,
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : 'Could not load customer',
        });
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return state;
}
