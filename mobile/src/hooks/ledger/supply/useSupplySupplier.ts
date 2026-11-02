
import { useEffect, useState } from 'react';

import { PartyRepository } from '@/repositories/party/party';
import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

import type { SupplySupplierState } from './types';

const partyRepository = new PartyRepository();

const ledgerSummaryRepository =
  new LedgerSummaryRepository();

const identityRepository =
  new LocalIdentityRepository();

const INITIAL_STATE: SupplySupplierState = {
  shopId: null,
  deviceId: null,
  supplier: null,
  balance: 0,
  loading: true,
  error: null,
};

/**
 * Load and verify the selected supplier.
 *
 * - Local identity is authoritative.
 * - Supplier must belong to the current shop.
 * - Supplier must be active and of type SUPPLIER.
 * - Balance is read from the local ledger.
 * - No network access is required.
 */
export function useSupplySupplier(
  supplierId?: string
): SupplySupplierState {
  const [state, setState] =
    useState<SupplySupplierState>({
      ...INITIAL_STATE,
    });

  useEffect(() => {
    let cancelled = false;

    setState({
      ...INITIAL_STATE,
    });

    async function initialize(): Promise<void> {
      try {
        const normalizedSupplierId =
          supplierId?.trim();

        if (!normalizedSupplierId) {
          throw new Error('Supplier ID is missing');
        }

        /*
         * Local installation identity is the
         * authoritative shop/device source.
         */
        const identity =
          await identityRepository.get();

        if (cancelled) {
          return;
        }

        if (
          !identity ||
          !identity.shopId?.trim() ||
          !identity.deviceId?.trim()
        ) {
          throw new Error(
            'Local installation identity not found'
          );
        }

        const shopId = identity.shopId.trim();
        const deviceId = identity.deviceId.trim();

        /*
         * getByIdAndShop excludes soft-deleted
         * parties and enforces shop ownership.
         */
        const currentSupplier =
          await partyRepository.getByIdAndShop(
            normalizedSupplierId,
            shopId
          );

        if (cancelled) {
          return;
        }

        if (
          !currentSupplier ||
          currentSupplier.type !== 'SUPPLIER'
        ) {
          throw new Error('Supplier not found');
        }

        /*
         * Supplier balance is calculated from
         * the local ledger and works offline.
         */
        const currentBalance =
          await ledgerSummaryRepository
            .getSupplierBalance(
              shopId,
              normalizedSupplierId
            );

        if (cancelled) {
          return;
        }

        setState({
          shopId,
          deviceId,
          supplier: currentSupplier,
          balance: currentBalance,
          loading: false,
          error: null,
        });
      } catch (cause) {
        if (cancelled) {
          return;
        }

        console.warn(
          '[add-supply] Supplier initialization failed:',
          cause
        );

        setState({
          shopId: null,
          deviceId: null,
          supplier: null,
          balance: 0,
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : 'Could not load supplier',
        });
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  return state;
}
