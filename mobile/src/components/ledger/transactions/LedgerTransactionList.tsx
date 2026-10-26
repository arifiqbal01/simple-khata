
import React, { useCallback } from 'react';

import {
  ActivityIndicator,
  FlatList,
  View,
  type ListRenderItem,
} from 'react-native';

import {
  AppText,
  EmptyState,
} from '@/components/ui';

import type {
  PartyTransactionEntry,
} from '@/hooks/ledger/usePartyTransactions';

import type {
  TransactionFilterState,
} from '@/components/ledger/header/transaction-filter.types';

import { LedgerRow } from './LedgerRow';

export interface LedgerTransactionListProps {
  entries: PartyTransactionEntry[];

  filter: TransactionFilterState;

  loading?: boolean;
  loadingMore?: boolean;
  refreshing?: boolean;
  hasMore?: boolean;

  error?: string | null;

  selectedEntryId?: string | null;
  isDeleting?: boolean;

  onSelectEntry?: (entryId: string) => void;

  onDeleteEntry?: (
    entry: PartyTransactionEntry
  ) => void | Promise<void>;

  onRefresh?: () => void | Promise<void>;
  onLoadMore?: () => void | Promise<void>;

  /**
   * Optional custom message for an empty
   * transaction list.
   */
  emptyDescription?: string;

  /**
   * Balance summary, action buttons,
   * and filters appear above transactions.
   */
  ListHeaderComponent?: React.ReactElement | null;
}

export function LedgerTransactionList({
  entries,
  filter,
  loading = false,
  loadingMore = false,
  refreshing = false,
  hasMore = false,
  error = null,
  selectedEntryId = null,
  isDeleting = false,
  onSelectEntry,
  onDeleteEntry,
  onRefresh,
  onLoadMore,
  emptyDescription,
  ListHeaderComponent,
}: LedgerTransactionListProps) {
  const handleEndReached = useCallback(() => {
    if (
      loading ||
      loadingMore ||
      !hasMore ||
      !onLoadMore
    ) {
      return;
    }

    void onLoadMore();
  }, [
    loading,
    loadingMore,
    hasMore,
    onLoadMore,
  ]);

  const renderItem = useCallback<
    ListRenderItem<PartyTransactionEntry>
  >(
    ({ item }) => (
      <LedgerRow
        entry={item}
        selected={selectedEntryId === item.id}
        onPress={
          onSelectEntry
            ? () => onSelectEntry(item.id)
            : undefined
        }
        onDelete={onDeleteEntry}
        isDeleting={isDeleting}
      />
    ),
    [
      selectedEntryId,
      onSelectEntry,
      onDeleteEntry,
      isDeleting,
    ]
  );

  const defaultEmptyDescription =
    filter.type === 'recent'
      ? 'Record a transaction to get started.'
      : 'Try another date or date range.';

  return (
    <FlatList
      data={entries}
      keyExtractor={(entry) => entry.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-8"

      // Header supplied by the parent screen.
      ListHeaderComponent={
        <>
          {ListHeaderComponent}

          {error ? (
            <View className="mt-5 rounded-control bg-udhaar-soft px-4 py-3">
              <AppText className="text-[13px] text-udhaar">
                {error}
              </AppText>
            </View>
          ) : null}

          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="small" />

              <AppText className="mt-3 text-[13px] text-muted">
                Loading transactions...
              </AppText>
            </View>
          ) : null}
        </>
      }

      // Pull-to-refresh.
      refreshing={refreshing}
      onRefresh={
        onRefresh
          ? () => {
              void onRefresh();
            }
          : undefined
      }

      // Load older transactions.
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}

      // Empty state.
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            icon="receipt-outline"
            title={
              filter.type === 'recent'
                ? 'No transactions yet'
                : 'No transactions found'
            }
            description={
              emptyDescription ??
              defaultEmptyDescription
            }
            className="py-14"
          />
        ) : null
      }

      // Pagination indicator.
      ListFooterComponent={
        loadingMore ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" />

            <AppText className="mt-2 text-[12px] text-muted">
              Loading older transactions...
            </AppText>
          </View>
        ) : null
      }
    />
  );
}
