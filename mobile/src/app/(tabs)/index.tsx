
import React, {
  useCallback,
  useMemo,
} from 'react';

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

const HOME_RECENT_LIMIT = 10;

export default function HomeScreen() {
  const {
    shopName,
    deviceName,
    parties,

    toReceive,
    toPay,

    query,
    loading,
    refreshing,
    error,
    setQuery,
    refresh,
  } = useHomeData();

  const isSearching = query.trim().length > 0;

  /*
   * The Home data hook should return parties
   * ordered by their latest activity.
   *
   * Limit the visible Home list to 10 only
   * when the user is not searching.
   */
  const visibleParties = useMemo(() => {
    if (isSearching) {
      return parties;
    }

    return parties.slice(0, HOME_RECENT_LIMIT);
  }, [parties, isSearching]);

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

  return (
    <Screen className="bg-background">
      <PartyList
        parties={visibleParties}
        refreshing={refreshing}
        onRefresh={refresh}
        onOpenParty={handleOpenParty}
        onQuickTransaction={handleQuickTransaction}
        contentContainerClassName={
          visibleParties.length === 0
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
              toReceive={toReceive}
              toPay={toPay}
            />

            <View className="mb-4">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search customers or suppliers..."
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

            {visibleParties.length > 0 && !isSearching ? (
              <View className="mb-3 flex-row items-center justify-between px-1">
                <AppText
                  className="font-spline-semibold text-[14px] text-foreground"
                >
                  Recent activity
                </AppText>

                <AppText
                  className="text-[12px] text-muted"
                >
                  Latest {HOME_RECENT_LIMIT}
                </AppText>
              </View>
            ) : null}

            {visibleParties.length > 0 && isSearching ? (
              <View className="mb-3 px-1">
                <AppText
                  className="font-spline-medium text-[12px] text-muted"
                >
                  Search results
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