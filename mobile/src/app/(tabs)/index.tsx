
import React from 'react';
import {
  ActivityIndicator,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { CustomerList } from '@/components/customer';

import {
  HomeHeader,
  OutstandingSummary,
  AddCustomerButton,
} from '@/components/home';

import {
  EmptyState,
  Screen,
  SearchField,
  AppText,
} from '@/components/ui';

import { useHomeData } from '@/hooks/home/useHomeData';

export default function HomeScreen() {
  const {
    shopName,
    deviceName,
    customers,
    totalOutstanding,
    totalMoneyOut,
    totalMoneyIn,
    query,
    loading,
    refreshing,
    error,
    setQuery,
    refresh,
  } = useHomeData();

  function handleQuickUdhaar(customerId: string) {
    router.push({
      pathname: '/customer/[id]/udhaar',
      params: {
        id: customerId,
        from: 'home',
      },
    });
  }

  function handleCustomerDetails(customerId: string) {
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
      <Screen className="bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  const isSearching = query.trim().length > 0;

  return (
    <Screen className="bg-background">
      <CustomerList
        customers={customers}
        refreshing={refreshing}
        onRefresh={refresh}
        onQuickUdhaar={handleQuickUdhaar}
        onOpenCustomer={handleCustomerDetails}
        contentContainerClassName={
          customers.length === 0
            ? 'flex-grow pb-5'
            : 'pb-5'
        }
        ListHeaderComponent={
          <View>
            <HomeHeader
              shopName={shopName}
              deviceName={deviceName}
            />

            <OutstandingSummary
              amount={totalOutstanding}
              moneyOut={totalMoneyOut}
              moneyIn={totalMoneyIn}
            />

            <View className="mb-5">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search customers..."
              />
            </View>

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

      <AddCustomerButton
        onPress={handleAddCustomer}
      />
    </Screen>
  );
}
