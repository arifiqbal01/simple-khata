
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import {
  AppText,
  SearchField,
} from '@/components/ui';

import {
  ItemList,
  ItemSummary,
} from '@/components/item';

import { useItems } from '@/hooks/item/useItems';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

export default function ItemsScreen() {
  /*
   * Search input is owned by the screen.
   * Database search is debounced.
   */
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchQuery(query.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  const {
    shopId,
    loading: identityLoading,
    error: identityError,
    reload: reloadIdentity,
  } = useShopIdentity();

  const {
    items,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useItems({
    shopId: shopId ?? '',
    query: searchQuery,
  });

  /*
   * Refresh when returning from add/edit/delete.
   */
  useFocusEffect(
    useCallback(() => {
      if (shopId) {
        void refresh();
      }
    }, [shopId, refresh])
  );

  const handleRefresh = useCallback(() => {
    if (shopId) {
      void refresh();
    } else {
      void reloadIdentity();
    }
  }, [shopId, refresh, reloadIdentity]);

  const handleOpenItem = useCallback((id: string) => {
    router.push({
      pathname: '/items/[id]',
      params: { id },
    });
  }, []);

  const handleAddItem = useCallback(() => {
    router.push('/items/new');
  }, []);

  const handleLoadMore = useCallback(() => {
    if (
      !identityLoading &&
      shopId &&
      !loading &&
      !loadingMore &&
      !refreshing &&
      hasMore
    ) {
      void loadMore();
    }
  }, [
    identityLoading,
    shopId,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    loadMore,
  ]);

  /*
   * Prevent search results from briefly showing
   * the previous query's products.
   */
  const searchPending =
    query.trim() !== searchQuery;

const visibleItems = (searchPending ? [] : items).map(
  (item) => ({
    ...item,
    default_unit: item.default_unit ?? null,
    default_selling_price:
      item.default_selling_price ?? null,
  })
);

  if (identityLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator
          size="small"
          color="#242422"
        />
      </View>
    );
  }

  if (!shopId) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <Ionicons
          name="storefront-outline"
          size={38}
          color="#9A9A93"
        />

        <AppText className="mt-4 text-center font-spline-semibold text-[17px] text-foreground">
          Shop Unavailable
        </AppText>

        <AppText className="mt-2 text-center text-[13px] text-muted">
          {identityError ??
            'Could not load your shop identity.'}
        </AppText>

        <Pressable
          onPress={() => {
            void reloadIdentity();
          }}
          accessibilityRole="button"
          className="mt-5 rounded-xl bg-chip px-6 py-3"
        >
          <AppText className="font-spline-semibold text-foreground">
            Try Again
          </AppText>
        </Pressable>
      </View>
    );
  }

  const initialLoading =
    loading && visibleItems.length === 0;

  return (
    <View className="flex-1 bg-background">
      <ItemList
        items={visibleItems}
        onOpenItem={handleOpenItem}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View className="pb-5 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <AppText className="font-spline-bold text-[25px] text-foreground">
                Items
              </AppText>

              <Pressable
                onPress={handleAddItem}
                accessibilityRole="button"
                accessibilityLabel="Add new item"
                hitSlop={10}
                className="
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  bg-chip
                  active:opacity-70
                "
              >
                <Ionicons
                  name="add"
                  size={23}
                  color="#242422"
                />
              </Pressable>
            </View>

            <ItemSummary
              totalItems={items.length}
              loading={initialLoading}
            />

            <View className="mt-5">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search items"
              />
            </View>

            <View className="mt-6 flex-row items-center justify-between">
              <AppText className="font-spline-semibold text-[18px] text-foreground">
                All Items
              </AppText>

              <AppText className="text-[12px] text-muted">
                {visibleItems.length} shown
              </AppText>
            </View>

            {error && !searchPending ? (
              <View className="mt-3">
                <AppText className="text-[13px] text-red-600">
                  {error}
                </AppText>

                <Pressable
                  onPress={handleRefresh}
                  accessibilityRole="button"
                  className="mt-2 self-start"
                >
                  <AppText className="font-spline-semibold text-[13px] text-foreground">
                    Try Again
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          initialLoading || searchPending ? (
            <View className="items-center py-12">
              <ActivityIndicator
                size="small"
                color="#242422"
              />
            </View>
          ) : error ? null : (
            <View className="items-center py-12">
              <Ionicons
                name="cube-outline"
                size={36}
                color="#9A9A93"
              />

              <AppText className="mt-3 font-spline-semibold text-[16px] text-foreground">
                {query.trim()
                  ? 'No matching items'
                  : 'No items yet'}
              </AppText>

              <AppText className="mt-2 text-center text-[13px] text-muted">
                {query.trim()
                  ? 'Try another search term.'
                  : 'Add your first item to the catalog.'}
              </AppText>
            </View>
          )
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#242422"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
      />
    </View>
  );
}
