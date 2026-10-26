
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useFocusEffect } from 'expo-router';

import {
  getSyncState,
  subscribeToSyncState,
} from '@/services/sync/sync-coordinator';

import { PartyRepository } from '@/repositories/party/party';

import { DeviceRepository } from '@/repositories/bootstrap/device';
import { LocalIdentityRepository } from '@/repositories/bootstrap/local-identity';
import { ShopRepository } from '@/repositories/bootstrap/shop';

import { InitializeAppService } from '@/services/bootstrap/initialize';

export type HomePartyType = 'CUSTOMER' | 'SUPPLIER';

type PartyBalanceSummary = Awaited<
  ReturnType<PartyRepository['getBalanceSummary']>
>;

type BalanceParty =
  PartyBalanceSummary['parties'][number];

export type HomeParty = BalanceParty & {
  type: HomePartyType;
};

const partyRepository = new PartyRepository();

const initializeAppService = new InitializeAppService(
  new ShopRepository(),
  new DeviceRepository(),
  new LocalIdentityRepository()
);

function calculateShopBalances(
  customers: BalanceParty[],
  suppliers: BalanceParty[]
) {
  let toReceive = 0;
  let toPay = 0;

  for (const party of customers) {
    const balance = party.balance;

    if (balance > 0) {
      toReceive += balance;
    } else if (balance < 0) {
      toPay += Math.abs(balance);
    }
  }

  for (const party of suppliers) {
    const balance = party.balance;

    if (balance > 0) {
      toPay += balance;
    } else if (balance < 0) {
      toReceive += Math.abs(balance);
    }
  }

  return {
    toReceive,
    toPay,
    netBalance: toReceive - toPay,
  };
}

export function useHomeData() {
  const [shopId, setShopId] =
    useState<string | null>(null);

  const [shopName, setShopName] = useState('');
  const [deviceName, setDeviceName] = useState('');

  const [parties, setParties] =
    useState<HomeParty[]>([]);

  const [toReceive, setToReceive] = useState(0);
  const [toPay, setToPay] = useState(0);
  const [netBalance, setNetBalance] = useState(0);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const requestIdRef = useRef(0);
  const queryRef = useRef('');
  const mountedRef = useRef(false);
  const refreshingRef = useRef(false);

  const syncState = useSyncExternalStore(
    subscribeToSyncState,
    getSyncState,
    getSyncState
  );

  const loadHome = useCallback(
    async (
      currentShopId: string,
      searchQuery = '',
      showRefreshing = false
    ): Promise<void> => {
      const currentRequest = ++requestIdRef.current;

      if (showRefreshing) {
        refreshingRef.current = true;
        setRefreshing(true);
      }

      try {
        setError(null);

        const search = searchQuery.trim();

        /*
         * Shop totals always use ALL active parties.
         * Search only filters the displayed party list.
         */
        const [
          allCustomers,
          allSuppliers,
        ] = await Promise.all([
          partyRepository.getBalanceSummary(
            currentShopId,
            'CUSTOMER'
          ),
          partyRepository.getBalanceSummary(
            currentShopId,
            'SUPPLIER'
          ),
        ]);

        if (
          !mountedRef.current ||
          currentRequest !== requestIdRef.current
        ) {
          return;
        }

        const balances = calculateShopBalances(
          allCustomers.parties,
          allSuppliers.parties
        );

        setToReceive(balances.toReceive);
        setToPay(balances.toPay);
        setNetBalance(balances.netBalance);

        let customerParties = allCustomers.parties;
        let supplierParties = allSuppliers.parties;

        if (search) {
          const [
            filteredCustomers,
            filteredSuppliers,
          ] = await Promise.all([
            partyRepository.getBalanceSummary(
              currentShopId,
              'CUSTOMER',
              search
            ),
            partyRepository.getBalanceSummary(
              currentShopId,
              'SUPPLIER',
              search
            ),
          ]);

          if (
            !mountedRef.current ||
            currentRequest !== requestIdRef.current
          ) {
            return;
          }

          customerParties = filteredCustomers.parties;
          supplierParties = filteredSuppliers.parties;
        }

        const combinedParties: HomeParty[] = [
          ...customerParties.map((party) => ({
            ...party,
            type: 'CUSTOMER' as const,
          })),
          ...supplierParties.map((party) => ({
            ...party,
            type: 'SUPPLIER' as const,
          })),
        ];

        combinedParties.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setParties(combinedParties);
      } catch (loadError) {
        if (
          !mountedRef.current ||
          currentRequest !== requestIdRef.current
        ) {
          return;
        }

        console.error(
          '[home] Failed to load data:',
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load khata'
        );
      } finally {
        if (
          currentRequest === requestIdRef.current &&
          mountedRef.current
        ) {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        const identity =
          await initializeAppService.execute();

        if (cancelled) return;

        if (!identity) {
          throw new Error(
            'Shop or device has not been initialized'
          );
        }

        const { shop, device } = identity;

        setShopId(shop.id);
        setShopName(shop.name);
        setDeviceName(device.name ?? '');

        await loadHome(
          shop.id,
          queryRef.current
        );
      } catch (initializeError) {
        if (cancelled) return;

        console.error(
          '[home] Failed to initialize:',
          initializeError
        );

        setError(
          initializeError instanceof Error
            ? initializeError.message
            : 'Could not load khata'
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
  }, [loadHome]);

  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) return;

      void loadHome(
        shopId,
        queryRef.current
      );
    }, [shopId, loading, loadHome])
  );

  useEffect(() => {
    if (
      !shopId ||
      loading ||
      syncState.dataVersion === 0
    ) {
      return;
    }

    void loadHome(
      shopId,
      queryRef.current
    );
  }, [
    syncState.dataVersion,
    shopId,
    loading,
    loadHome,
  ]);

  const handleSearch = useCallback(
    (value: string) => {
      queryRef.current = value;
      setQuery(value);

      requestIdRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (!shopId || loading) return;

    const timeout = setTimeout(() => {
      void loadHome(shopId, query);
    }, 180);

    return () => clearTimeout(timeout);
  }, [
    query,
    shopId,
    loading,
    loadHome,
  ]);

  const refresh = useCallback(async () => {
    if (!shopId || refreshingRef.current) {
      return;
    }

    await loadHome(
      shopId,
      queryRef.current,
      true
    );
  }, [shopId, loadHome]);

  return {
    shopName,
    deviceName,
    parties,

    // New party-based financial totals
    toReceive,
    toPay,
    netBalance,

    // Compatibility with existing Home callers.
    // These now represent financial positions,
    // NOT historical transaction flows.
    totalOutstanding: netBalance,
    totalMoneyOut: toReceive,
    totalMoneyIn: toPay,

    query,
    loading,
    refreshing,
    error,

    setQuery: handleSearch,
    refresh,
  };
}
