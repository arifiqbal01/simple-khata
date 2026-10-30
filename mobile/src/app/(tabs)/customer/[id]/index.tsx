
import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import Toast from 'react-native-toast-message';

import { AppHeader } from '@/components/layout';

import {
  AppText,
  Screen,
} from '@/components/ui';

import { ConfirmModal } from '@/components/ui/ConfirmModal';

import { PartyLedgerHeader } from '@/components/ledger/header/PartyLedgerHeader';
import { LedgerTransactionList } from '@/components/ledger/transactions/LedgerTransactionList';

import { formatRupees } from '@/utils/ledger/format-rupees';

import { LedgerSummaryRepository } from '@/repositories/ledger/ledger-summary';

import type {
  LedgerHistoryEntry,
} from '@/repositories/ledger/ledger-history';

import { usePartyLedger } from '@/hooks/ledger/usePartyLedger';
import { usePartyTransactions } from '@/hooks/ledger/usePartyTransactions';
import { useSharePartyLedger } from '@/hooks/ledger/useSharePartyLedger';
import { useDeleteLedgerEntry } from '@/hooks/ledger/useDeleteLedgerEntry';

import { useShopIdentity } from '@/hooks/shop/useShopIdentity';
import { useConfirm } from '@/hooks/ui/useConfirm';

const ledgerSummaryRepository =
  new LedgerSummaryRepository();

interface CustomerSummary {
  totalUdhaar: number;
  totalPayments: number;
  outstanding: number;
}

export default function CustomerLedgerScreen() {
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

  const {
    shopId,
    party,
    balance,
    loading: partyLoading,
    refreshing: partyRefreshing,
    error: partyError,
    reload,
    refresh: refreshParty,
  } = usePartyLedger(customerId, 'CUSTOMER');

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
  } = usePartyTransactions(
    shopId ?? undefined,
    customerId,
    'CUSTOMER'
  );

  const [
    customerSummary,
    setCustomerSummary,
  ] = useState<CustomerSummary | null>(null);

  const summaryRequestRef = useRef(0);

  const loadCustomerSummary = useCallback(
    async (): Promise<void> => {
      if (!shopId || !customerId) {
        setCustomerSummary(null);
        return;
      }

      const requestId =
        ++summaryRequestRef.current;

      const summary =
        await ledgerSummaryRepository.getCustomerLedgerSummary(
          shopId,
          customerId
        );

      if (
        requestId !== summaryRequestRef.current
      ) {
        return;
      }

      setCustomerSummary({
        totalUdhaar: summary.totalUdhaar,
        totalPayments: summary.totalPayments,
        outstanding: summary.outstanding,
      });
    },
    [shopId, customerId]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void loadCustomerSummary().catch((error) => {
        if (active) {
          console.error(
            '[customer-ledger] Summary failed:',
            error
          );
        }
      });

      return () => {
        active = false;
        summaryRequestRef.current += 1;
      };
    }, [loadCustomerSummary])
  );

  const { share, isSharing } =
    useSharePartyLedger({
      shopId: shopId ?? '',
      partyId: customerId ?? '',
      partyType: 'CUSTOMER',
      partyName: party?.name ?? '',
      shopName,
    });

  const {
    deleteEntry,
    isDeleting,
  } = useDeleteLedgerEntry({
    shopId,
    onDeleted: async () => {
      await Promise.all([
        reload(),
        loadCustomerSummary(),
      ]);

      refreshTransactions();
    },
  });

  const { confirm, confirmProps } = useConfirm();

  const [refreshing, setRefreshing] =
    useState(false);

  const refreshingRef = useRef(false);

  const [selectedEntryId, setSelectedEntryId] =
    useState<string | null>(null);

  const loading = partyLoading && !party;

  const handleBack = useCallback(() => {
    if (from === 'customers') {
      router.replace('/customer');
      return;
    }

    router.replace('/');
  }, [from]);

  const handleAddUdhaar = useCallback(() => {
    if (!customerId) {
      return;
    }

    router.push({
      pathname: '/customer/[id]/udhaar',
      params: {
        id: customerId,
        from: 'ledger',
        ledgerFrom: from ?? 'home',
      },
    });
  }, [customerId, from]);

  const handlePayment = useCallback(() => {
    if (!customerId) {
      return;
    }

    router.push({
      pathname: '/customer/[id]/payment',
      params: {
        id: customerId,
        from: 'ledger',
        ledgerFrom: from ?? 'home',
      },
    });
  }, [customerId, from]);

  const handleSelectEntry = useCallback(
    (entryId: string) => {
      if (isDeleting) {
        return;
      }

      setSelectedEntryId((current) =>
        current === entryId ? null : entryId
      );
    },
    [isDeleting]
  );

  const handleRefresh = useCallback(
    async (): Promise<void> => {
      if (refreshingRef.current) {
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);

      try {
        await Promise.all([
          refreshParty(),
          loadCustomerSummary(),
        ]);

        refreshTransactions();
        setSelectedEntryId(null);
      } catch (error) {
        console.error(
          '[customer-ledger] Refresh failed:',
          error
        );

        Toast.show({
          type: 'error',
          text1: 'Refresh failed',
          text2:
            error instanceof Error
              ? error.message
              : 'Could not refresh ledger history.',
        });
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    [
      refreshParty,
      loadCustomerSummary,
      refreshTransactions,
    ]
  );

  const handleDelete = useCallback(
    async (
      entry: LedgerHistoryEntry
    ): Promise<void> => {
      if (isDeleting) {
        return;
      }

      const entryTitle =
        entry.type === 'UDHAAR'
          ? 'Udhaar'
          : 'Payment';

      const approved = await confirm({
        title: 'Delete ledger entry?',
        message:
          `Are you sure you want to delete this ` +
          `${entryTitle.toLowerCase()} entry of ` +
          `Rs ${formatRupees(entry.amount)}? ` +
          'The customer balance will be updated.',
        confirmText: 'Delete Entry',
        cancelText: 'Cancel',
        destructive: true,
      });

      if (!approved) {
        return;
      }

      try {
        await deleteEntry(entry);
        setSelectedEntryId(null);
      } catch (error) {
        console.error(
          '[customer-ledger] Delete failed:',
          error
        );

        Toast.show({
          type: 'error',
          text1: 'Delete failed',
          text2:
            error instanceof Error
              ? error.message
              : 'Could not delete the entry.',
        });
      }
    },
    [isDeleting, confirm, deleteEntry]
  );

  const handleShareWhatsApp = useCallback(() => {
    if (!shopName) {
      Toast.show({
        type: 'error',
        text1: 'Shop name unavailable',
        text2: 'Please try again.',
      });

      return;
    }

    void share();
  }, [shopName, share]);

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  if (!party) {
    return (
      <Screen>
        <AppHeader
          title="Customer"
          showBack
          onBackPress={handleBack}
        />

        <View className="flex-1 items-center justify-center px-6">
          <AppText className="text-center text-udhaar">
            {partyError ?? 'Customer not found.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={party.name}
        showBack
        onBackPress={handleBack}
      />

      <LedgerTransactionList
        entries={entries}
        refreshing={
          refreshing || partyRefreshing
        }
        onRefresh={() => {
          void handleRefresh();
        }}
        loading={transactionsLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={() => {
          void loadMore();
        }}
        selectedEntryId={selectedEntryId}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDelete}
        isDeleting={isDeleting}
        filter={filter}
        emptyDescription={
          filter.type === 'recent'
            ? 'Add Udhaar or record a payment to get started.'
            : 'Try another date or date range.'
        }
        ListHeaderComponent={
          <>
           <PartyLedgerHeader
                  partyType="CUSTOMER"
                  hideSummaryTitle
                  balance={balance}
                  moneyOut={customerSummary?.totalUdhaar ?? 0}
                  moneyIn={customerSummary?.totalPayments ?? 0}
                  filter={filter}
                  onFilterChange={setFilter}
                  onAddTransaction={handleAddUdhaar}
                  onPayment={handlePayment}
                  onShareWhatsApp={handleShareWhatsApp}
                  isSharing={isSharing}
                />

            {partyError || transactionsError ? (
              <View className="mt-5 rounded-control bg-udhaar-soft px-4 py-3">
                <AppText className="text-[13px] text-udhaar">
                  {transactionsError ?? partyError}
                </AppText>
              </View>
            ) : null}
          </>
        }
      />

      <ConfirmModal {...confirmProps} />
    </Screen>
  );
}
