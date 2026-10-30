
import React, { useCallback } from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PartyList } from '@/components/party';
import { AppHeader } from '@/components/layout';
import { FinancialSummary } from '@/components/ledger/shared';

import {
  AppText,
  Button,
  ConfirmModal,
  EmptyState,
  Screen,
  SearchField,
} from '@/components/ui';

import { usePartyList } from '@/hooks/party/usePartyList';
import { usePartyFinancialTotals } from '@/hooks/party/usePartyFinancialTotals';
import { useDeleteParty } from '@/hooks/party/useDeleteParty';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

export default function CustomersScreen() {
  const {
    parties,
    query,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    totalCount,
    error,
    handleSearch,
    refresh,
    loadMore,
  } = usePartyList('CUSTOMER');

  const {
    totals: customerTotals,
    error: totalsError,
    refresh: refreshTotals,
  } = usePartyFinancialTotals('CUSTOMER');

  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
  } = useShopIdentity();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refresh(),
      refreshTotals(),
    ]);
  }, [refresh, refreshTotals]);

  const onDeleted = useCallback(async () => {
    await handleRefresh();
  }, [handleRefresh]);

  const {
    partyToDelete,
    deletingPartyId,
    deleteError,
    confirmDeleteParty,
    cancelDeleteParty,
    executeDeleteParty,
  } = useDeleteParty({
    shopId,
    deviceId,
    onDeleted,
  });

  const handleQuickUdhaar = useCallback(
    (partyId: string) => {
      router.push({
        pathname: '/customer/[id]/udhaar',
        params: {
          id: partyId,
          from: 'customers',
        },
      });
    },
    []
  );

  const handleOpenCustomer = useCallback(
    (partyId: string) => {
      router.push({
        pathname: '/customer/[id]',
        params: {
          id: partyId,
          from: 'customers',
        },
      });
    },
    []
  );

  const handleAddCustomer = useCallback(() => {
    router.push({
      pathname: '/customer/new',
      params: {
        from: 'customers',
      },
    });
  }, []);

  const handleLoadMore = useCallback(() => {
    if (
      loading ||
      refreshing ||
      loadingMore ||
      !hasMore
    ) {
      return;
    }

    void loadMore();
  }, [
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMore,
  ]);

  const isSearching = query.trim().length > 0;

  if (loading || identityLoading) {
    return (
      <Screen>
        <AppHeader title="Customers" />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color="#242422"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Customers" />

      {/* Customer financial overview */}
      {customerTotals !== null && (
        <FinancialSummary
          variant="customer"
          title="CUSTOMER OVERVIEW"
          balanceLabel="Net Balance"
          balance={
            customerTotals.toPay -
            customerTotals.toReceive
          }
          leftLabel="To Receive"
          leftAmount={customerTotals.toPay}
          leftDirection="receive"
          rightLabel="To Pay"
          rightAmount={customerTotals.toReceive}
          rightDirection="pay"
        />
      )}

      <View className="mb-4">
        <SearchField
          value={query}
          onChangeText={handleSearch}
          placeholder="Search customers"
        />
      </View>

      {error ||
      identityError ||
      deleteError ||
      totalsError ? (
        <View className="mb-4 rounded-control bg-udhaar-soft px-4 py-3">
          <AppText
            variant="small"
            className="text-udhaar"
          >
            {deleteError ??
              identityError ??
              totalsError ??
              error}
          </AppText>
        </View>
      ) : null}

      <PartyList
        partyType="CUSTOMER"
        parties={parties}
        deletingPartyId={deletingPartyId}
        onDeleteParty={confirmDeleteParty}
        refreshing={refreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
        onQuickTransaction={handleQuickUdhaar}
        onOpenParty={handleOpenCustomer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        contentContainerClassName={
          parties.length === 0
            ? 'flex-grow pb-4'
            : 'pb-4'
        }
        ListHeaderComponent={
          parties.length > 0 ? (
            <View className="mb-3 flex-row items-center justify-between px-1">
              <AppText className="font-spline-medium text-[12px] text-muted">
                {isSearching
                  ? 'Search results'
                  : 'Recently active customers'}
              </AppText>

              <AppText className="text-[12px] text-muted">
                {parties.length} of {totalCount}
              </AppText>
            </View>
          ) : null
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
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-5">
              <ActivityIndicator
                size="small"
                color="#242422"
              />
            </View>
          ) : null
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

      <ConfirmModal
        visible={partyToDelete !== null}
        title="Delete customer?"
        message={
          `Are you sure you want to delete ` +
          `${partyToDelete?.name ?? 'this customer'}? ` +
          `This change will sync to your other devices.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        loading={deletingPartyId !== null}
        onConfirm={() => {
          void executeDeleteParty();
        }}
        onCancel={cancelDeleteParty}
      />
    </Screen>
  );
}
