
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

import { PartyRepository } from '@/repositories/party/party';
import { LedgerHistoryRepository } from '@/repositories/ledger/ledger-history';
import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';

const partyRepository = new PartyRepository();
const ledgerHistoryRepository =
  new LedgerHistoryRepository();
const ledgerSummaryRepository =
  new LedgerSummaryRepository();
const localIdentityRepository =
  new LocalIdentityRepository();

export type PartyType = 'CUSTOMER' | 'SUPPLIER';

export type LedgerParty = NonNullable<
  Awaited<
    ReturnType<PartyRepository['getByIdAndShop']>
  >
>;

export type PartyLedgerHistory = Awaited<
  ReturnType<LedgerHistoryRepository['listByParty']>
>;

export interface UsePartyLedgerResult {
  shopId: string | null;
  party: LedgerParty | null;
  entries: PartyLedgerHistory;
  balance: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePartyLedger(
  partyId?: string,
  partyType: PartyType = 'CUSTOMER'
): UsePartyLedgerResult {
  const [shopId, setShopId] =
    useState<string | null>(null);

  const [party, setParty] =
    useState<LedgerParty | null>(null);

  const [entries, setEntries] =
    useState<PartyLedgerHistory>([]);

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const refreshingRef = useRef(false);

  const loadLedger = useCallback(
    async (
      currentShopId: string
    ): Promise<void> => {
      const requestId = ++requestIdRef.current;

      if (!partyId) {
        throw new Error('Party ID is missing');
      }

      const currentParty =
        await partyRepository.getByIdAndShop(
          partyId,
          currentShopId
        );

      if (
        !currentParty ||
        currentParty.type !== partyType
      ) {
        throw new Error(
          partyType === 'CUSTOMER'
            ? 'Customer not found'
            : 'Supplier not found'
        );
      }

      const balancePromise =
        partyType === 'CUSTOMER'
          ? ledgerSummaryRepository.getCustomerBalance(
              currentShopId,
              partyId
            )
          : ledgerSummaryRepository.getSupplierBalance(
              currentShopId,
              partyId
            );

      const [currentBalance, history] =
        await Promise.all([
          balancePromise,
          ledgerHistoryRepository.listByParty(
            currentShopId,
            partyId
          ),
        ]);

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setParty(currentParty);
      setBalance(currentBalance);
      setEntries(history);
    },
    [partyId, partyType]
  );

  const reload = useCallback(
    async (): Promise<void> => {
      if (!shopId) {
        return;
      }

      try {
        setError(null);
        await loadLedger(shopId);
      } catch (loadError) {
        if (!mountedRef.current) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Could not load party ledger';

        setError(message);

        console.error(
          '[party-ledger] Reload failed:',
          loadError
        );

        throw loadError;
      }
    },
    [shopId, loadLedger]
  );

  const refresh = useCallback(
    async (): Promise<void> => {
      if (
        !shopId ||
        refreshingRef.current
      ) {
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);

      try {
        await reload();
      } finally {
        refreshingRef.current = false;

        if (mountedRef.current) {
          setRefreshing(false);
        }
      }
    },
    [shopId, reload]
  );

  // Initialize shop identity and party ledger.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function initialize(): Promise<void> {
      setLoading(true);
      setError(null);
      setShopId(null);
      setParty(null);
      setEntries([]);
      setBalance(0);

      try {
        if (!partyId) {
          throw new Error('Party ID is missing');
        }

        const identity =
          await localIdentityRepository.get();

        if (!identity) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        if (cancelled) {
          return;
        }

        setShopId(identity.shopId);

        await loadLedger(identity.shopId);
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

        const message =
          initializeError instanceof Error
            ? initializeError.message
            : 'Could not initialize party ledger';

        setError(message);

        console.error(
          '[party-ledger] Initialization failed:',
          initializeError
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
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [partyId, loadLedger]);

  // Reload when returning from transaction screens.
  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      void reload().catch((focusError) => {
        console.error(
          '[party-ledger] Focus reload failed:',
          focusError
        );
      });
    }, [shopId, loading, reload])
  );

  return {
    shopId,
    party,
    entries,
    balance,
    loading,
    refreshing,
    error,
    reload,
    refresh,
  };
}
