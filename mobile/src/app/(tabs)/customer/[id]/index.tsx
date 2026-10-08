
import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  SectionList,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import Toast from 'react-native-toast-message';

import { formatRupees } from '@/utils/ledger/format-rupees';

import { LedgerRow } from '@/components/ledger/LedgerRow';

import { CustomerLedgerHeader } from '@/components/ledger/CustomerLedgerHeader';

import { AppHeader } from '@/components/layout';

import {
  AppText,
  EmptyState,
  Screen,
  SectionLabel,
} from '@/components/ui';

import { ConfirmModal } from '@/components/ui/ConfirmModal';

import type {
  LedgerHistoryEntry,
} from '@/repositories/ledger';

import {
  useCustomerLedger,
} from '@/hooks/ledger/useCustomerLedger';

import {
  useCustomerTransactions,
} from '@/hooks/ledger/useCustomerTransactions';

import {
  useDeleteLedgerEntry,
} from '@/hooks/ledger/useDeleteLedgerEntry';

import {
  useShareCustomerLedger,
} from '@/hooks/ledger/useShareCustomerLedger';

import { useConfirm } from '@/hooks/ui/useConfirm';

import {
  groupLedgerEntries,
} from '@/utils/ledger/groupLedgerEntries';

export default function CustomerLedgerScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
  }>();

  const customerId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const from = Array.isArray(params.from)
    ? params.from[0]
    : params.from;

  // Customer details and current balance
  const {
    shopId,
    customer,
    balance,
    loading: customerLoading,
    refreshing: customerRefreshing,
    error: customerError,
    reload,
    refresh: refreshCustomer,
  } = useCustomerLedger(customerId);

  // Paginated transaction history
  const {
    entries,
    filter,
    setFilter,
    loading: transactionsLoading,
    loadingMore,
    hasMore,
    error: transactionsError,
    loadMore,
    refresh: refreshTransactions,
  } = useCustomerTransactions(
    shopId ?? undefined,
    customerId
  );

  // WhatsApp ledger summary sharing
  const {
    share,
    isSharing,
  } = useShareCustomerLedger({
    shopId: shopId ?? '',
    customerId: customerId ?? '',
    customerName: customer?.name ?? '',
    shopName: 'Simple Khata',
  });

  // Delete transaction
  const {
    deleteEntry,
    isDeleting,
  } = useDeleteLedgerEntry({
    shopId,
    onDeleted: async () => {
      await reload();
      refreshTransactions();
    },
  });

  // Delete confirmation modal
  const {
    confirm,
    confirmProps,
  } = useConfirm();

  // Pull-to-refresh state
  const [refreshing, setRefreshing] =
    useState(false);

  // Only one transaction can show its delete icon
  const [selectedEntryId, setSelectedEntryId] =
    useState<string | null>(null);

  // Group transactions by day
  const sections = useMemo(
    () => groupLedgerEntries(entries),
    [entries]
  );

  const loading = customerLoading && !customer;

  // Navigation
  function handleBack(): void {
    if (from === 'customers') {
      router.replace('/customers');
      return;
    }

    router.replace('/');
  }

  function handleAddUdhaar(): void {
    if (!customerId) return;

    router.push({
      pathname: '/customer/[id]/udhaar',
      params: {
        id: customerId,
        from: 'ledger',
        ledgerFrom: from ?? 'home',
      },
    });
  }

  function handlePayment(): void {
    if (!customerId) return;

    router.push({
      pathname: '/customer/[id]/payment',
      params: {
        id: customerId,
        from: 'ledger',
        ledgerFrom: from ?? 'home',
      },
    });
  }

  // Transaction selection
  function handleSelectEntry(entryId: string): void {
    if (isDeleting) return;

    setSelectedEntryId((current) =>
      current === entryId ? null : entryId
    );
  }

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      await refreshCustomer();
      refreshTransactions();

      setSelectedEntryId(null);
    } catch (cause) {
      console.error(
        '[customer-ledger] refresh failed',
        cause
      );

      Toast.show({
        type: 'error',
        text1: 'Refresh failed',
        text2:
          cause instanceof Error
            ? cause.message
            : 'Could not refresh ledger history.',
      });
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing,
    refreshCustomer,
    refreshTransactions,
  ]);

  // Delete transaction with confirmation
  async function handleDelete(
    entry: LedgerHistoryEntry
  ): Promise<void> {
    if (isDeleting) return;

    const entryType =
      entry.type === 'UDHAAR'
        ? 'Udhaar'
        : 'Payment';

    const approved = await confirm({
      title: 'Delete ledger entry?',
      message:
        `Are you sure you want to delete this ` +
        `${entryType.toLowerCase()} entry of ` +
        `Rs ${formatRupees(entry.amount)}? ` +
        'The customer balance will be updated.',
      confirmText: 'Delete Entry',
      cancelText: 'Cancel',
      destructive: true,
    });

    if (!approved) return;

    try {
      await deleteEntry(entry);

      // The deletion hook refreshes customer
      // balance and transaction history.
      setSelectedEntryId(null);
    } catch (cause) {
      console.error(
        '[customer-ledger] delete failed',
        cause
      );

      Toast.show({
        type: 'error',
        text1: 'Delete failed',
        text2:
          cause instanceof Error
            ? cause.message
            : 'Could not delete the entry.',
      });
    }
  }

  // Initial customer loading
  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  // Customer not found
  if (!customer) {
    return (
      <Screen>
        <AppHeader
          title="Customer"
          showBack
          onBackPress={handleBack}
        />

        <View className="flex-1 items-center justify-center px-6">
          <AppText className="text-center text-udhaar">
            {customerError ?? 'Customer not found.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Customer name and back navigation */}
      <AppHeader
        title={customer.name}
        showBack
        onBackPress={handleBack}
      />

      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.id}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-8"

        // Pull-to-refresh
        refreshing={
          refreshing || customerRefreshing
        }
        onRefresh={() => {
          void handleRefresh();
        }}

        // Lazy load older transactions
        onEndReached={() => {
          if (
            !transactionsLoading &&
            !loadingMore &&
            hasMore
          ) {
            void loadMore();
          }
        }}
        onEndReachedThreshold={0.3}

        // Balance, actions and filters
        ListHeaderComponent={
          <>
            <CustomerLedgerHeader
              balance={balance}
              filter={filter}
              onAddUdhaar={handleAddUdhaar}
              onPayment={handlePayment}
              onShareWhatsApp={share}
              isSharing={isSharing}
              onFilterChange={(nextFilter) => {
                setSelectedEntryId(null);
                setFilter(nextFilter);
              }}
            />

            {/* Customer or transaction errors */}
            {customerError ||
            transactionsError ? (
              <View className="mt-5 rounded-control bg-udhaar-soft px-4 py-3">
                <AppText className="text-[13px] text-udhaar">
                  {transactionsError ??
                    customerError}
                </AppText>
              </View>
            ) : null}

            {/* Initial transaction loading */}
            {transactionsLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator
                  size="small"
                />

                <AppText className="mt-3 text-[13px] text-muted">
                  Loading transactions...
                </AppText>
              </View>
            ) : null}
          </>
        }

        // Day headings
        renderSectionHeader={({ section }) => (
          <SectionLabel className="bg-background pb-2 pt-8">
            {section.title}
          </SectionLabel>
        )}

        // Transaction row
        renderItem={({ item }) => (
          <LedgerRow
            entry={item}
            selected={
              selectedEntryId === item.id
            }
            onPress={() =>
              handleSelectEntry(item.id)
            }
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}

        // Empty history
        ListEmptyComponent={
          !transactionsLoading ? (
            <EmptyState
              icon="receipt-outline"
              title={
                filter.type === 'recent'
                  ? 'No recent transactions'
                  : 'No transactions found'
              }
              description={
                filter.type === 'recent'
                  ? 'Check older transactions if available.'
                  : 'Try another date or date range.'
              }
              className="py-14"
            />
          ) : null
        }

        // Pagination loader
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-6">
              <ActivityIndicator
                size="small"
              />

              <AppText className="mt-2 text-[12px] text-muted">
                Loading older transactions...
              </AppText>
            </View>
          ) : null
        }
      />

      {/* Destructive action confirmation */}
      <ConfirmModal {...confirmProps} />
    </Screen>
  );
}
