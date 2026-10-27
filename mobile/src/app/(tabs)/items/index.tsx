
import React, {
  useCallback,
  useEffect,
  useMemo,
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

import { AppHeader } from '@/components/layout';

import {
  AppText,
  Button,
  EmptyState,
  Screen,
  SearchField,
} from '@/components/ui';

import {
  ItemList,
  ItemSummary,
} from '@/components/item';

import { useItems } from '@/hooks/item/useItems';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

const SEARCH_DEBOUNCE_MS = 250;

export default function ItemsScreen() {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);

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
      identityLoading ||
      !shopId ||
      loading ||
      loadingMore ||
      refreshing ||
      !hasMore
    ) {
      return;
    }

    void loadMore();
  }, [
    identityLoading,
    shopId,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    loadMore,
  ]);

  const searchPending =
    query.trim() !== searchQuery;

  const visibleItems = useMemo(() => {
    if (searchPending) {
      return [];
    }

    return items.map((item) => ({
      ...item,
      default_unit: item.default_unit ?? null,
      default_selling_price:
        item.default_selling_price ?? null,
    }));
  }, [items, searchPending]);

  const initialLoading =
    loading && visibleItems.length === 0;

  if (identityLoading) {
    return (
      <Screen>
        <AppHeader title="Items" />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color="#242422"
          />
        </View>
      </Screen>
    );
  }

  if (!shopId) {
    return (
      <Screen>
        <AppHeader title="Items" />

        <View className="flex-1 items-center justify-center px-5">
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
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Items" />

      <View className="mb-4">
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search items"
        />
      </View>

      {error && !searchPending ? (
        <View className="mb-4 rounded-control bg-udhaar-soft px-4 py-3">
          <AppText
            variant="small"
            className="text-udhaar"
          >
            {error}
          </AppText>
        </View>
      ) : null}

      <ItemList
        items={visibleItems}
        onOpenItem={handleOpenItem}
        contentContainerStyle={{
          paddingBottom: 16,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View className="mb-3">
            <ItemSummary
              totalItems={items.length}
              loading={initialLoading}
            />

            <View className="mt-5 flex-row items-center justify-between px-1">
              <AppText className="font-spline-medium text-[12px] text-muted">
                {query.trim()
                  ? 'Search results'
                  : 'Recently added items'}
              </AppText>

              <AppText className="text-[12px] text-muted">
                {visibleItems.length} loaded
              </AppText>
            </View>
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
            <EmptyState
              icon={
                query.trim()
                  ? 'search-outline'
                  : 'cube-outline'
              }
              title={
                query.trim()
                  ? 'No matching items'
                  : 'No items yet'
              }
              description={
                query.trim()
                  ? 'Try another search term.'
                  : 'Add your first item to the catalog.'
              }
            />
          )
        }
        ListFooterComponent={
          loadingMore && !searchPending ? (
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

      <View className="pt-3">
        <Button
          label="Add Item"
          onPress={handleAddItem}
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
