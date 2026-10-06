import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
} from 'expo-router';

import { CustomerList } from '@/components/customer';
import { AppHeader } from '@/components/layout';
import {
  AppText,
  Button,
  EmptyState,
  Screen,
  SearchField,
} from '@/components/ui';
import {
  CustomerRepository,
  type CustomerWithBalance,
} from '@/repositories/customer';
import { ShopRepository } from '@/repositories/shop';

const customerRepository = new CustomerRepository();
const shopRepository = new ShopRepository();

export default function CustomersScreen() {
  const [shopId, setShopId] = useState<
    string | null
  >(null);

  const [customers, setCustomers] = useState<
    CustomerWithBalance[]
  >([]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const loadCustomers = useCallback(
    async (
      currentShopId: string,
      searchQuery: string
    ) => {
      const result =
        await customerRepository.getBalanceSummary(
          currentShopId,
          searchQuery
        );

      setCustomers(result.customers);
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

        await loadCustomers(shop.id, '');
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

        const message =
          initializeError instanceof Error
            ? initializeError.message
            : 'Could not load customers';

        console.error(
          'Failed to initialize customers:',
          initializeError
        );

        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadCustomers]);

  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      loadCustomers(shopId, query).catch(
        (focusError) => {
          console.error(
            'Failed to refresh customers:',
            focusError
          );
        }
      );
    }, [shopId, loading, query, loadCustomers])
  );

  async function handleSearch(value: string) {
    setQuery(value);

    if (!shopId) {
      return;
    }

    try {
      setError(null);

      await loadCustomers(shopId, value);
    } catch (searchError) {
      const message =
        searchError instanceof Error
          ? searchError.message
          : 'Could not search customers';

      console.error(
        'Customer search failed:',
        searchError
      );

      setError(message);
    }
  }

  async function handleRefresh() {
    if (!shopId || refreshing) {
      return;
    }

    try {
      setRefreshing(true);
      setError(null);

      await loadCustomers(shopId, query);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : 'Could not refresh customers';

      console.error(
        'Failed to refresh customers:',
        refreshError
      );

      setError(message);
    } finally {
      setRefreshing(false);
    }
  }

  function handleQuickUdhaar(
    customerId: string
  ) {
    router.push({
      pathname: '/customer/[id]/udhaar',
      params: {
        id: customerId,
        from: 'customers',
      },
    });
  }

  function handleOpenCustomer(
    customerId: string
  ) {
    router.push({
      pathname: '/customer/[id]',
      params: {
        id: customerId,
        from: 'customers',
      },
    });
  }

  function handleAddCustomer() {
    router.push({
      pathname: '/new-customer',
      params: {
        from: 'customers',
      },
    });
  }

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Customers" />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  const isSearching =
    query.trim().length > 0;

  return (
    <Screen>
      <AppHeader title="Customers" />

      <View className="mb-4">
        <SearchField
          value={query}
          onChangeText={handleSearch}
          placeholder="Search customers"
        />
      </View>

      {error ? (
        <View className="mb-4 rounded-control bg-udhaar-soft px-4 py-3">
          <AppText
            variant="small"
            className="text-udhaar"
          >
            {error}
          </AppText>
        </View>
      ) : null}

      <CustomerList
        customers={customers}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onQuickUdhaar={handleQuickUdhaar}
        onOpenCustomer={handleOpenCustomer}
        contentContainerClassName={
          customers.length === 0
            ? 'flex-grow'
            : 'pb-4'
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
                ? `No customer matches "${query.trim()}".`
                : 'Add your first customer to start recording udhaar and payments.'
            }
          />
        }
      />

      <View className="pt-3">
        <Button
          label="Add Customer"
          onPress={handleAddCustomer}
          left={
            <Ionicons
              name="add"
              size={21}
              color="#FFFFFF"
            />
          }
        />
      </View>
    </Screen>
  );
}