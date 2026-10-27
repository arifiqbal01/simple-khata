
import React, {
  useCallback,
  useRef,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PartyList } from '@/components/party';
import { AppHeader } from '@/components/layout';

import {
  AppText,
  Button,
  ConfirmModal,
  EmptyState,
  Screen,
  SearchField,
} from '@/components/ui';

import { usePartyList } from '@/hooks/party/usePartyList';
import { useDeleteParty } from '@/hooks/party/useDeleteParty';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

const PAGE_SIZE = 25;

export default function SuppliersScreen() {
  const {
    parties,
    query,
    loading,
    refreshing,
    error,
    handleSearch,
    refresh,

    // Pagination support from usePartyList.
    hasMore,
    loadingMore,
    loadMore,
  } = usePartyList('SUPPLIER', {
    pageSize: PAGE_SIZE,
  });

  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
  } = useShopIdentity();

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
    onDeleted: refresh,
  });

  const endReachedRef = useRef(false);

  const handleOpenSupplier = useCallback(
    (supplierId: string) => {
      router.push({
        pathname: '/suppliers/[id]',
        params: {
          id: supplierId,
          from: 'suppliers',
        },
      });
    },
    []
  );

  const handleQuickSupply = useCallback(
    (supplierId: string) => {
      router.push({
        pathname: '/suppliers/[id]/supply',
        params: {
          id: supplierId,
          from: 'suppliers',
        },
      });
    },
    []
  );

  const handleAddSupplier = useCallback(() => {
    router.push('/suppliers/new');
  }, []);

  const handleRefresh = useCallback(() => {
    endReachedRef.current = false;
    void refresh();
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (
      !hasMore ||
      loadingMore ||
      loading ||
      refreshing ||
      endReachedRef.current
    ) {
      return;
    }

    endReachedRef.current = true;
    void loadMore();
  }, [
    hasMore,
    loadingMore,
    loading,
    refreshing,
    loadMore,
  ]);

  const handleSearchChange = useCallback(
    (value: string) => {
      endReachedRef.current = false;
      handleSearch(value);
    },
    [handleSearch]
  );

  const isSearching = query.trim().length > 0;
  const isInitialLoading = loading || identityLoading;

  if (isInitialLoading) {
    return (
      <Screen>
        <AppHeader title="Suppliers" />

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
      <AppHeader title="Suppliers" />

      <View className="mb-4">
        <SearchField
          value={query}
          onChangeText={handleSearchChange}
          placeholder="Search suppliers"
        />
      </View>

      {error || identityError || deleteError ? (
        <View className="mb-4 rounded-control bg-udhaar-soft px-4 py-3">
          <AppText
            variant="small"
            className="text-udhaar"
          >
            {deleteError ?? identityError ?? error}
          </AppText>
        </View>
      ) : null}

      <PartyList
        partyType="SUPPLIER"
        parties={parties.map((party) => ({
          ...party,
          lastActivityAt:
            party.last_activity_at ??
            party.updated_at ??
            party.created_at,
        }))}
        deletingPartyId={deletingPartyId}
        onDeleteParty={confirmDeleteParty}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onOpenParty={handleOpenSupplier}
        onQuickTransaction={handleQuickSupply}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
        onMomentumScrollBegin={() => {
          endReachedRef.current = false;
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
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
                  : 'Recently active suppliers'}
              </AppText>

              <AppText className="text-[12px] text-muted">
                {parties.length} loaded
              </AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={
              isSearching
                ? 'search-outline'
                : 'business-outline'
            }
            title={
              isSearching
                ? 'No suppliers found'
                : 'No suppliers yet'
            }
            description={
              isSearching
                ? `No supplier matches "${query.trim()}".`
                : 'Add your first supplier to start recording supplies and payments.'
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
          ) : hasMore && parties.length > 0 ? (
            <Pressable
              onPress={() => {
                endReachedRef.current = false;
                void loadMore();
              }}
              accessibilityRole="button"
              accessibilityLabel="Load more suppliers"
              className="my-3 min-h-11 flex-row items-center justify-center gap-2 rounded-control border border-border bg-surface px-4"
            >
              <AppText className="font-spline-medium text-[13px] text-foreground">
                Load more suppliers
              </AppText>

              <Ionicons
                name="chevron-down"
                size={15}
                color="#777770"
              />
            </Pressable>
          ) : null
        }
      />

      <View className="pt-3">
        <Button
          label="Add Supplier"
          onPress={handleAddSupplier}
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
        title="Delete supplier?"
        message={
          `Are you sure you want to delete ` +
          `${partyToDelete?.name ?? 'this supplier'}? ` +
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
