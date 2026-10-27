
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

type PartyBalancePage = Awaited<
  ReturnType<PartyRepository['getBalancePage']>
>;

type BalanceParty = PartyBalancePage['parties'][number];

export type HomeParty = BalanceParty & {
  type: HomePartyType;
};

const HOME_RECENT_LIMIT = 10;
const SEARCH_DELAY_MS = 250;

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
    if (party.balance > 0) {
      toReceive += party.balance;
    } else if (party.balance < 0) {
      toPay += Math.abs(party.balance);
    }
  }

  for (const party of suppliers) {
    if (party.balance > 0) {
      toPay += party.balance;
    } else if (party.balance < 0) {
      toReceive += Math.abs(party.balance);
    }
  }

  return {
    toReceive,
    toPay,
    netBalance: toReceive - toPay,
  };
}

function activityTimestamp(
  party: HomeParty
): string {
  return (
    party.last_activity_at ??
    party.created_at ??
    ''
  );
}

function sortByRecentActivity(
  parties: HomeParty[]
): HomeParty[] {
  return parties.sort((a, b) => {
    const aActivity = activityTimestamp(a);
    const bActivity = activityTimestamp(b);

    const activityComparison =
      bActivity.localeCompare(aActivity);

    if (activityComparison !== 0) {
      return activityComparison;
    }

    return b.id.localeCompare(a.id);
  });
}

function combineParties(
  customers: BalanceParty[],
  suppliers: BalanceParty[]
): HomeParty[] {
  return sortByRecentActivity([
    ...customers.map((party) => ({
      ...party,
      type: 'CUSTOMER' as const,
    })),
    ...suppliers.map((party) => ({
      ...party,
      type: 'SUPPLIER' as const,
    })),
  ]);
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

  const [query, setQueryState] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const queryRef = useRef('');
  const shopIdRef = useRef<string | null>(null);

  const refreshingRef = useRef(false);
  const initializedRef = useRef(false);

  const searchTimerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const syncState = useSyncExternalStore(
    subscribeToSyncState,
    getSyncState,
    getSyncState
  );

  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  const loadHome = useCallback(
    async (
      currentShopId: string,
      searchQuery = '',
      showRefreshing = false
    ): Promise<void> => {
      const requestId = ++requestIdRef.current;

      if (showRefreshing) {
        refreshingRef.current = true;
        setRefreshing(true);
      }

      try {
        const search = searchQuery.trim();

        /*
         * Full-shop financial totals must remain
         * independent of the visible party list.
         *
         * These two calls currently read all
         * party balances to calculate the
         * positive/negative financial positions.
         */
        const [
          customerSummary,
          supplierSummary,
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
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const balances = calculateShopBalances(
          customerSummary.parties,
          supplierSummary.parties
        );

        /*
         * Fetch the visible list separately.
         *
         * With no search, fetching 10 from each
         * type is sufficient to identify the
         * newest 10 across both types.
         *
         * Search is not restricted to the
         * recent Home records.
         */
        const [
          customerPage,
          supplierPage,
        ] = await Promise.all([
          partyRepository.getBalancePage(
            currentShopId,
            'CUSTOMER',
            {
              query: search,
              limit: search
                ? 500
                : HOME_RECENT_LIMIT,
              offset: 0,
            }
          ),
          partyRepository.getBalancePage(
            currentShopId,
            'SUPPLIER',
            {
              query: search,
              limit: search
                ? 500
                : HOME_RECENT_LIMIT,
              offset: 0,
            }
          ),
        ]);

        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        const combined = combineParties(
          customerPage.parties,
          supplierPage.parties
        );

        setToReceive(balances.toReceive);
        setToPay(balances.toPay);
        setNetBalance(balances.netBalance);

        setParties(
          search
            ? combined
            : combined.slice(0, HOME_RECENT_LIMIT)
        );

        setError(null);
      } catch (loadError) {
        if (
          !mountedRef.current ||
          requestId !== requestIdRef.current
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
          mountedRef.current &&
          requestId === requestIdRef.current
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

        if (cancelled) {
          return;
        }

        if (!identity) {
          throw new Error(
            'Shop or device has not been initialized'
          );
        }

        const { shop, device } = identity;

        shopIdRef.current = shop.id;

        setShopId(shop.id);
        setShopName(shop.name);
        setDeviceName(device.name ?? '');

        await loadHome(
          shop.id,
          queryRef.current
        );

        initializedRef.current = true;
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

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
      clearSearchTimer();
    };
  }, [loadHome, clearSearchTimer]);

  useFocusEffect(
    useCallback(() => {
      if (!initializedRef.current) {
        return;
      }

      const currentShopId = shopIdRef.current;

      if (!currentShopId) {
        return;
      }

      clearSearchTimer();

      void loadHome(
        currentShopId,
        queryRef.current
      );
    }, [loadHome, clearSearchTimer])
  );

  useEffect(() => {
    if (
      !shopId ||
      loading ||
      syncState.dataVersion === 0
    ) {
      return;
    }

    clearSearchTimer();

    void loadHome(
      shopId,
      queryRef.current
    );
  }, [
    syncState.dataVersion,
    shopId,
    loading,
    loadHome,
    clearSearchTimer,
  ]);

  const handleSearch = useCallback(
    (value: string) => {
      queryRef.current = value;
      setQueryState(value);

      /*
       * Invalidate any in-flight request
       * immediately when the query changes.
       */
      requestIdRef.current += 1;

      clearSearchTimer();

      const currentShopId = shopIdRef.current;

      if (!currentShopId) {
        return;
      }

      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;

        void loadHome(
          currentShopId,
          value
        );
      }, SEARCH_DELAY_MS);
    },
    [loadHome, clearSearchTimer]
  );

  const refresh = useCallback(async () => {
    const currentShopId = shopIdRef.current;

    if (
      !currentShopId ||
      refreshingRef.current
    ) {
      return;
    }

    clearSearchTimer();

    await loadHome(
      currentShopId,
      queryRef.current,
      true
    );
  }, [loadHome, clearSearchTimer]);

  return {
    shopName,
    deviceName,
    parties,

    toReceive,
    toPay,
    netBalance,

    // Existing Home compatibility values.
    // These are financial positions, not
    // historical transaction-flow totals.
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
