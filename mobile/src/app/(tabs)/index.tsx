import React, {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
} from 'expo-router';
import {
  getSyncState,
  subscribeToSyncState,
} from '@/services/sync/sync-coordinator';
import { CustomerList } from '@/components/customer';
import {
  AppText,
  EmptyState,
  Screen,
  SearchField,
  SyncStatusBadge,
} from '@/components/ui';

import {
  CustomerRepository,
  type CustomerWithBalance,
} from '@/repositories/customer';
import { ShopRepository } from '@/repositories/shop';

const customerRepository =
  new CustomerRepository();

const shopRepository =
  new ShopRepository();

export default function HomeScreen() {
  const [shopId, setShopId] = useState<
    string | null
  >(null);

  const [customers, setCustomers] = useState<
    CustomerWithBalance[]
  >([]);

  const [
    totalOutstanding,
    setTotalOutstanding,
  ] = useState(0);

  const [query, setQuery] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

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
    ) => {
      if (showRefreshing) {
        setRefreshing(true);
      }

      try {
        setError(null);

        const result =
          await customerRepository.getBalanceSummary(
            currentShopId,
            searchQuery
          );

        setCustomers(result.customers);

        if (!searchQuery.trim()) {
          setTotalOutstanding(
            result.totalOutstanding
          );
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Could not load khata';

        console.error(
          'Failed to load home:',
          loadError
        );

        setError(message);
      } finally {
        if (showRefreshing) {
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        const shop =
          await shopRepository.getFirst();

        if (!shop) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        if (cancelled) {
          return;
        }

        setShopId(shop.id);

        await loadHome(shop.id);
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

        const message =
          initializeError instanceof Error
            ? initializeError.message
            : 'Could not load khata';

        console.error(
          'Failed to initialize home:',
          initializeError
        );

        setError(message);
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
  }, [loadHome]);

  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      void loadHome(shopId, query);
    }, [
      shopId,
      loading,
      query,
      loadHome,
    ])
  );

useEffect(() => {
  if (
    !shopId ||
    loading ||
    syncState.dataVersion === 0
  ) {
    return;
  }

  void loadHome(shopId, query);
}, [
  syncState.dataVersion,
  shopId,
  loading,
  query,
  loadHome,
]);

  async function handleSearch(
    value: string
  ) {
    setQuery(value);

    if (!shopId) {
      return;
    }

    await loadHome(
      shopId,
      value
    );
  }

  async function handleRefresh() {
    if (!shopId || refreshing) {
      return;
    }

    await loadHome(
      shopId,
      query,
      true
    );
  }

  function handleQuickUdhaar(
    customerId: string
  ) {
    router.push({
      pathname: '/customer/[id]/udhaar',
      params: {
        id: customerId,
        from: 'home',
      },
    });
  }

  function handleCustomerDetails(
    customerId: string
  ) {
    router.push({
      pathname: '/customer/[id]',
      params: {
        id: customerId,
        from: 'home',
      },
    });
  }

  function handleAddCustomer() {
    router.push({
      pathname: '/new-customer',
      params: {
        from: 'home',
      },
    });
  }

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  const isSearching =
    query.trim().length > 0;

  return (
    <Screen className="bg-background">
      <CustomerList
        customers={customers}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onQuickUdhaar={handleQuickUdhaar}
        onOpenCustomer={
          handleCustomerDetails
        }
        contentContainerClassName={
          customers.length === 0
            ? 'flex-grow pb-5'
            : 'pb-5'
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View
              className="
                h-[92px]
                flex-row
                items-center
                justify-between
              "
            >
              <AppText
                variant="title"
                className="
                  text-[30px]
                  leading-[36px]
                "
              >
                Khata
              </AppText>

              <SyncStatusBadge />
            </View>

            {/* Outstanding */}
            <View className="pb-12 pt-2">
              <AppText
                className="
                  font-spline-semibold
                  text-[15px]
                  uppercase
                  tracking-[0.2px]
                  text-muted
                "
              >
                Total Outstanding
              </AppText>

              <AppText
                className="
                  mt-3
                  font-spline-bold
                  text-[42px]
                  leading-[48px]
                  text-foreground
                "
              >
                Rs{' '}
                {totalOutstanding.toLocaleString()}
              </AppText>
            </View>

            {/* Search */}
            <View className="mb-8">
              <SearchField
                value={query}
                onChangeText={
                  handleSearch
                }
                placeholder="Search customers..."
              />
            </View>

            {/* Error */}
            {error ? (
              <View className="mb-5 rounded-control bg-udhaar-soft px-4 py-3">
                <AppText
                  variant="small"
                  className="text-udhaar"
                >
                  {error}
                </AppText>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={
              isSearching
                ? 'search-outline'
                : 'people-outline'
            }
            title={
              isSearching
                ? 'No customers found'
                : 'No customers yet'
            }
            description={
              isSearching
                ? 'Try a different name or phone number.'
                : 'Add your first customer to start recording udhaar and payments.'
            }
          />
        }
      />

      {/* Add customer */}
      <View className="pb-3 pt-3">
        <Pressable
          onPress={handleAddCustomer}
          accessibilityRole="button"
          className="
            min-h-[64px]
            flex-row
            items-center
            justify-center
            rounded-[16px]
            bg-primary
            px-6
            active:opacity-75
          "
        >
          <Ionicons
            name="person-add-outline"
            size={22}
            color="#FFFFFF"
          />

          <AppText
            className="
              ml-3
              font-spline-semibold
              text-[18px]
              text-inverse
            "
          >
            + Customer
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}