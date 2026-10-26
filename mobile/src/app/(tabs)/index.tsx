
import React, { useCallback } from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  PartyList,
  type PartyRowType,
} from '@/components/party';

import {
  HomeHeader,
  OutstandingSummary,
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
  parties,

  // New party-based summary values
  toReceive,
  toPay,
  netBalance,

  // Existing values retained for compatibility
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

  const handleOpenParty = useCallback(
    (
      partyId: string,
      partyType: PartyRowType
    ) => {
      if (partyType === 'SUPPLIER') {
        router.push({
          pathname: '/suppliers/[id]',
          params: {
            id: partyId,
            from: 'home',
          },
        });

        return;
      }

      router.push({
        pathname: '/customer/[id]',
        params: {
          id: partyId,
          from: 'home',
        },
      });
    },
    []
  );

  const handleQuickTransaction = useCallback(
    (
      partyId: string,
      partyType: PartyRowType
    ) => {
      if (partyType === 'SUPPLIER') {
        router.push({
          pathname: '/suppliers/[id]/supply',
          params: {
            id: partyId,
            from: 'home',
          },
        });

        return;
      }

      router.push({
        pathname: '/customer/[id]/udhaar',
        params: {
          id: partyId,
          from: 'home',
        },
      });
    },
    []
  );

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
      <PartyList
        parties={parties}
        refreshing={refreshing}
        onRefresh={refresh}
        onOpenParty={handleOpenParty}
        onQuickTransaction={handleQuickTransaction}
        contentContainerClassName={
          parties.length === 0
            ? 'flex-grow pb-5'
            : 'pb-5'
        }
        ListHeaderComponent={
          <View>
            {/* Keep original Home header */}
            <HomeHeader
              shopName={shopName}
              deviceName={deviceName}
            />

            {/* Keep original outstanding summary */}
            <OutstandingSummary
              toReceive={toReceive}
              toPay={toPay}
            />

            {/* Search customers and suppliers */}
            <View className="mb-5">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search parties..."
              />
            </View>

            {/* Error message */}
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
                ? 'No parties found'
                : 'No parties yet'
            }
            description={
              isSearching
                ? 'Try a different name or phone number.'
                : 'Add a customer or supplier to start recording transactions.'
            }
          />
        }
      />
    </Screen>
  );
}
