
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

import {
  CustomerRepository,
  type CustomerWithBalance,
} from '@/repositories/customer';

import { DeviceRepository } from '@/repositories/device';
import { LocalIdentityRepository } from '@/repositories/local-identity';
import { ShopRepository } from '@/repositories/shop';
import { InitializeAppService } from '@/services/bootstrap/initialize';

const customerRepository = new CustomerRepository();

const initializeAppService = new InitializeAppService(
  new ShopRepository(),
  new DeviceRepository(),
  new LocalIdentityRepository()
);

export function useHomeData() {
  const [shopId, setShopId] = useState<string | null>(
    null
  );

  const [shopName, setShopName] = useState('');
  const [deviceName, setDeviceName] = useState('');

  const [customers, setCustomers] = useState<
    CustomerWithBalance[]
  >([]);

  const [totalOutstanding, setTotalOutstanding] =
    useState(0);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const queryRef = useRef('');
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);

  const syncState = useSyncExternalStore(
    subscribeToSyncState,
    getSyncState,
    getSyncState
  );

  // Load customers and outstanding balance.
  const loadHome = useCallback(
    async (
      currentShopId: string,
      searchQuery = '',
      showRefreshing = false
    ) => {
      const currentRequest = ++requestId.current;

      if (showRefreshing) {
        refreshingRef.current = true;
        setRefreshing(true);
      }

      try {
        setError(null);

        const result =
          await customerRepository.getBalanceSummary(
            currentShopId,
            searchQuery
          );

        if (
          !mountedRef.current ||
          currentRequest !== requestId.current
        ) {
          return;
        }

        setCustomers(result.customers);

        if (!searchQuery.trim()) {
          setTotalOutstanding(
            result.totalOutstanding
          );
        }
      } catch (loadError) {
        if (
          !mountedRef.current ||
          currentRequest !== requestId.current
        ) {
          return;
        }

        console.error(
          'Failed to load home:',
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load khata'
        );
      } finally {
        if (showRefreshing) {
          refreshingRef.current = false;

          if (mountedRef.current) {
            setRefreshing(false);
          }
        }
      }
    },
    []
  );

  // Initialize the current shop and device.
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

        setShopId(shop.id);
        setShopName(shop.name);
        setDeviceName(device.name ?? '');

        await loadHome(
          shop.id,
          queryRef.current
        );
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

        console.error(
          'Failed to initialize home:',
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
      requestId.current += 1;
    };
  }, [loadHome]);

  // Reload when Home receives focus.
  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      void loadHome(
        shopId,
        queryRef.current
      );
    }, [shopId, loading, loadHome])
  );

  // Reload when synchronized data changes.
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

  // Update search query and invalidate stale results.
  const handleSearch = useCallback(
    (value: string) => {
      queryRef.current = value;
      setQuery(value);

      requestId.current += 1;
    },
    []
  );

  // Debounce customer search.
  useEffect(() => {
    if (!shopId || loading) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadHome(shopId, query);
    }, 180);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    query,
    shopId,
    loading,
    loadHome,
  ]);

  // Manual pull-to-refresh.
  const refresh = useCallback(async () => {
    if (
      !shopId ||
      refreshingRef.current
    ) {
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
    customers,
    totalOutstanding,
    query,
    loading,
    refreshing,
    error,
    setQuery: handleSearch,
    refresh,
  };
}
