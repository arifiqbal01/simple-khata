
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
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
} from '@/components/ui';

import { ConfirmModal } from '@/components/ui/ConfirmModal';

import {
  LedgerRepository,
  type LedgerHistoryEntry,
  type CustomerLedgerSummary,
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

import { useShopIdentity } from '@/hooks/shop/useShopIdentity';
import { useConfirm } from '@/hooks/ui/useConfirm';

const ledgerRepository = new LedgerRepository();

export default function CustomerLedgerScreen() {
  // Hooks must be called inside the component.
  const { shopName } = useShopIdentity();

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

  // All-time customer ledger totals
  const [customerSummary, setCustomerSummary] =
    useState<CustomerLedgerSummary>({
      totalUdhaar: 0,
      totalPayments: 0,
      outstanding: 0,
    });

  const loadCustomerSummary = useCallback(
    async () => {
      if (!shopId || !customerId) {
        return;
      }

      try {
        const summary =
          await ledgerRepository.getCustomerLedgerSummary(
            shopId,
            customerId
          );

        setCustomerSummary(summary);
      } catch (cause) {
        console.error(
          '[customer-ledger] summary failed',
          cause
        );
      }
    },
    [shopId, customerId]
  );

  // Reload summary when screen receives focus.
  // This handles returning from Add Udhaar / Payment.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        if (!shopId || !customerId) {
          return;
        }

        try {
          const summary =
            await ledgerRepository.getCustomerLedgerSummary(
              shopId,
              customerId
            );

          if (active) {
            setCustomerSummary(summary);
          }
        } catch (cause) {
          console.error(
            '[customer-ledger] summary failed',
            cause
          );
        }
      }

      void load();

      return () => {
        active = false;
      };
    }, [shopId, customerId])
  );

  // WhatsApp ledger summary sharing
  const {
    share,
    isSharing,
  } = useShareCustomerLedger({
    shopId: shopId ?? '',
    customerId: customerId ?? '',
    customerName: customer?.name ?? '',
    shopName,
  });

  // Delete transaction
  const {
    deleteEntry,
    isDeleting,
  } = useDeleteLedgerEntry({
    shopId,
    onDeleted: async () => {
      await reload();
      await loadCustomerSummary();
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
      await Promise.all([
        refreshCustomer(),
        loadCustomerSummary(),
      ]);

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
    loadCustomerSummary,
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

      {/* Flat transaction list: no date grouping */}
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        showsVerticalScrollIndicator={false}
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

        // Balance, summary cards, actions and filters
        ListHeaderComponent={
          <>
            <CustomerLedgerHeader
              balance={balance}
              moneyOut={customerSummary.totalUdhaar}
              moneyIn={customerSummary.totalPayments}
              filter={filter}
              onFilterChange={setFilter}
              onAddUdhaar={handleAddUdhaar}
              onPayment={handlePayment}
              onShareWhatsApp={() => {
                if (!shopName) {
                  Toast.show({
                    type: 'error',
                    text1: 'Shop name unavailable',
                    text2: 'Please try again.',
                  });
                  return;
                }

                void share();
              }}
              isSharing={isSharing}
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
                <ActivityIndicator size="small" />

                <AppText className="mt-3 text-[13px] text-muted">
                  Loading transactions...
                </AppText>
              </View>
            ) : null}
          </>
        }

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
                  ? 'No transactions yet'
                  : 'No transactions found'
              }
              description={
                filter.type === 'recent'
                  ? 'Add Udhaar or record a payment to get started.'
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
              <ActivityIndicator size="small" />

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
