
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useFocusEffect } from 'expo-router';

import { CustomerRepository } from '@/repositories/customer';

import {
  LedgerRepository,
  type LedgerHistoryEntry,
} from '@/repositories/ledger';

import { ShopRepository } from '@/repositories/shop';

import { GetCustomerBalanceService } from '@/services/ledger/get-balance';

import { GetLedgerHistoryService } from '@/services/ledger/get-history';

import type { Customer } from '@/types/domain';

const customerRepository = new CustomerRepository();
const ledgerRepository = new LedgerRepository();
const shopRepository = new ShopRepository();

const getBalanceService = new GetCustomerBalanceService(
  ledgerRepository,
  customerRepository
);

const getHistoryService = new GetLedgerHistoryService(
  ledgerRepository,
  customerRepository
);

export interface UseCustomerLedgerResult {
  shopId: string | null;
  customer: Customer | null;
  entries: LedgerHistoryEntry[];
  balance: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCustomerLedger(
  customerId?: string
): UseCustomerLedgerResult {
  const [shopId, setShopId] = useState<string | null>(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [entries, setEntries] =
    useState<LedgerHistoryEntry[]>([]);

  const [balance, setBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadLedger = useCallback(
    async (currentShopId: string): Promise<void> => {
      if (!customerId) {
        throw new Error('Customer ID is missing');
      }

      const currentCustomer =
        await customerRepository.getByIdAndShop(
          customerId,
          currentShopId
        );

      if (!currentCustomer) {
        throw new Error(
          `Customer not found: ${customerId}`
        );
      }

      const [currentBalance, history] = await Promise.all([
        getBalanceService.execute({
          shopId: currentShopId,
          customerId,
        }),

        getHistoryService.execute({
          shopId: currentShopId,
          customerId,
        }),
      ]);

      setCustomer(currentCustomer);
      setBalance(currentBalance);
      setEntries(history);
    },
    [customerId]
  );

  const reload = useCallback(async (): Promise<void> => {
    if (!shopId) {
      return;
    }

    try {
      setError(null);
      await loadLedger(shopId);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : 'Could not load customer ledger';

      setError(message);

      console.error(
        '[customer-ledger] reload failed',
        loadError
      );

      throw loadError;
    }
  }, [shopId, loadLedger]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!shopId || refreshing) {
      return;
    }

    setRefreshing(true);

    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [shopId, refreshing, reload]);

  // Initialize shop identity and load customer ledger.
  useEffect(() => {
    let cancelled = false;

    async function initialize(): Promise<void> {
      setLoading(true);
      setError(null);
      setCustomer(null);
      setEntries([]);
      setBalance(0);
      setShopId(null);

      try {
        if (!customerId) {
          throw new Error('Customer ID is missing');
        }

        const shop = await shopRepository.getFirst();

        if (!shop) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        if (cancelled) {
          return;
        }

        setShopId(shop.id);

        await loadLedger(shop.id);
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

        const message =
          initializeError instanceof Error
            ? initializeError.message
            : 'Could not initialize customer ledger';

        setError(message);

        console.error(
          '[customer-ledger] initialization failed',
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
    };
  }, [customerId, loadLedger]);

  // Reload when returning from Udhaar or Payment screens.
  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      void reload().catch((focusError) => {
        console.error(
          '[customer-ledger] focus reload failed',
          focusError
        );
      });
    }, [shopId, loading, reload])
  );

  return {
    shopId,
    customer,
    entries,
    balance,
    loading,
    refreshing,
    error,
    reload,
    refresh,
  };
}
