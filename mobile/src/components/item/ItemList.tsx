
import React, { useCallback } from 'react';

import {
  ActivityIndicator,
  FlatList,
  View,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native';

import { AppText } from '@/components/ui';

import {
  ItemRow,
  type ItemRowData,
} from './ItemRow';

export interface ItemListProps<
  T extends ItemRowData = ItemRowData
> extends Omit<
    FlatListProps<T>,
    | 'data'
    | 'renderItem'
    | 'keyExtractor'
    | 'onEndReached'
    | 'onRefresh'
    | 'refreshing'
  > {
  items: T[];
  onOpenItem: (id: string) => void;

  loading?: boolean;
  loadingMore?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;

  onLoadMore?: () => void | Promise<void>;
  onEndReached?: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

export function ItemList<
  T extends ItemRowData = ItemRowData
>({
  items,
  onOpenItem,

  loading = false,
  loadingMore = false,
  refreshing = false,
  hasMore = false,

  onLoadMore,
  onEndReached,
  onRefresh,

  ListFooterComponent,
  ...flatListProps
}: ItemListProps<T>) {
  const renderItem = useCallback<ListRenderItem<T>>(
    ({ item, index }) => (
      <ItemRow
        item={item}
        first={index === 0}
        last={index === items.length - 1}
        onOpenItem={() => onOpenItem(item.id)}
      />
    ),
    [items.length, onOpenItem]
  );

  const handleEndReached = useCallback(() => {
    if (
      loading ||
      loadingMore ||
      refreshing
    ) {
      return;
    }

    // Existing ItemList pagination interface.
    if (onLoadMore) {
      if (hasMore) {
        void onLoadMore();
      }
      return;
    }

    // FlatList-style pagination interface.
    if (onEndReached) {
      void onEndReached();
    }
  }, [
    loading,
    loadingMore,
    refreshing,
    hasMore,
    onLoadMore,
    onEndReached,
  ]);

  const handleRefresh = useCallback(() => {
    if (
      loading ||
      loadingMore ||
      refreshing ||
      !onRefresh
    ) {
      return;
    }

    void onRefresh();
  }, [
    loading,
    loadingMore,
    refreshing,
    onRefresh,
  ]);

  return (
    <FlatList
      {...flatListProps}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}

      // Virtualized rendering.
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}

      // Pull to refresh.
      refreshing={refreshing}
      onRefresh={
        onRefresh ? handleRefresh : undefined
      }

      // Scroll pagination.
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}

      // Loading indicator.
      ListFooterComponent={
        <>
          {loadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" />

              <AppText className="mt-2 text-[12px] text-muted">
                Loading more products...
              </AppText>
            </View>
          ) : null}

          {ListFooterComponent
            ? React.isValidElement(ListFooterComponent)
              ? ListFooterComponent
              : typeof ListFooterComponent === 'function'
                ? React.createElement(ListFooterComponent)
                : null
            : null}
        </>
      }
    />
  );
}
