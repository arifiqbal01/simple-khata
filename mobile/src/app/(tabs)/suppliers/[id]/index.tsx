
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
import { SupplierProductsLink } from '@/components/supplier/SupplierProductsLink';
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

import { usePartyLedger } from '@/hooks/ledger/usePartyLedger';
import {
  usePartyTransactions,
  type PartyTransactionEntry,
} from '@/hooks/ledger/usePartyTransactions';
import { useSharePartyLedger } from '@/hooks/ledger/useSharePartyLedger';
import { useDeleteLedgerEntry } from '@/hooks/ledger/useDeleteLedgerEntry';

import { useShopIdentity } from '@/hooks/shop/useShopIdentity';
import { useConfirm } from '@/hooks/ui/useConfirm';

const ledgerSummaryRepository =
  new LedgerSummaryRepository();

interface SupplierSummary {
  totalSupply: number;
  totalPayments: number;
  outstanding: number;
}

const EMPTY_SUMMARY: SupplierSummary = {
  totalSupply: 0,
  totalPayments: 0,
  outstanding: 0,
};

export default function SupplierLedgerScreen() {
  const { shopName } = useShopIdentity();

  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
  }>();

  const supplierId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const from = Array.isArray(params.from)
    ? params.from[0]
    : params.from;

  // Supplier details and payable balance.
  const {
    shopId,
    party,
    balance,
    loading: partyLoading,
    refreshing: partyRefreshing,
    error: partyError,
    reload,
    refresh: refreshParty,
  } = usePartyLedger(supplierId, 'SUPPLIER');

  // Shared transaction history.
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
    supplierId,
    'SUPPLIER'
  );

  const [supplierSummary, setSupplierSummary] =
    useState<SupplierSummary>(EMPTY_SUMMARY);

  const summaryRequestRef = useRef(0);

  const loadSupplierSummary = useCallback(
    async (): Promise<void> => {
      if (!shopId || !supplierId) {
        return;
      }

      const requestId =
        ++summaryRequestRef.current;

      const summary =
        await ledgerSummaryRepository.getSupplierLedgerSummary(
          shopId,
          supplierId
        );

      if (requestId !== summaryRequestRef.current) {
        return;
      }

      setSupplierSummary({
        totalSupply: summary.totalSupply,
        totalPayments: summary.totalPayments,
        outstanding: summary.outstanding,
      });
    },
    [shopId, supplierId]
  );

  // Reload totals when returning to the supplier ledger.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      setSupplierSummary(EMPTY_SUMMARY);

      void loadSupplierSummary().catch((error) => {
        if (active) {
          console.error(
            '[supplier-ledger] Summary failed:',
            error
          );
        }
      });

      return () => {
        active = false;
        summaryRequestRef.current += 1;
      };
    }, [loadSupplierSummary])
  );

  const { share, isSharing } =
    useSharePartyLedger({
      shopId: shopId ?? '',
      partyId: supplierId ?? '',
      partyType: 'SUPPLIER',
      partyName: party?.name ?? '',
      shopName,
    });

  const { deleteEntry, isDeleting } =
    useDeleteLedgerEntry({
      shopId,
      onDeleted: async () => {
        await Promise.all([
          reload(),
          loadSupplierSummary(),
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
    if (from === 'suppliers') {
      router.replace('/suppliers');
      return;
    }

    router.replace('/');
  }, [from]);

  const handleAddSupply = useCallback(() => {
    if (!supplierId) {
      return;
    }

    router.push({
      pathname: '/suppliers/[id]/supply',
      params: {
        id: supplierId,
        from: 'ledger',
        ledgerFrom: from ?? 'suppliers',
      },
    });
  }, [supplierId, from]);


const handleOpenProducts = useCallback(() => {
  if (!supplierId) return;

  router.push({
    pathname: '/suppliers/[id]/products',
    params: { id: supplierId },
  });
}, [supplierId]);

  const handlePayment = useCallback(() => {
    if (!supplierId) {
      return;
    }

    router.push({
      pathname: '/suppliers/[id]/payment',
      params: {
        id: supplierId,
        from: 'ledger',
        ledgerFrom: from ?? 'suppliers',
      },
    });
  }, [supplierId, from]);

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
          loadSupplierSummary(),
        ]);

        refreshTransactions();
        setSelectedEntryId(null);
      } catch (error) {
        console.error(
          '[supplier-ledger] Refresh failed:',
          error
        );

        Toast.show({
          type: 'error',
          text1: 'Refresh failed',
          text2:
            error instanceof Error
              ? error.message
              : 'Could not refresh supplier ledger.',
        });
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
      }
    },
    [
      refreshParty,
      loadSupplierSummary,
      refreshTransactions,
    ]
  );

  const handleDelete = useCallback(
    async (
      entry: PartyTransactionEntry
    ): Promise<void> => {
      if (isDeleting) {
        return;
      }

      const entryTitle =
        entry.type === 'SUPPLY'
          ? 'Supply'
          : entry.type === 'PAYMENT'
            ? 'Payment'
            : 'Ledger';

      const approved = await confirm({
        title: 'Delete ledger entry?',
        message:
          `Are you sure you want to delete this ` +
          `${entryTitle.toLowerCase()} entry of ` +
          `Rs ${formatRupees(entry.amount)}? ` +
          'The supplier payable balance will be updated.',
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
          '[supplier-ledger] Delete failed:',
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
          title="Supplier"
          showBack
          onBackPress={handleBack}
        />

        <View className="flex-1 items-center justify-center px-6">
          <AppText className="text-center text-udhaar">
            {partyError ?? 'Supplier not found.'}
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
            ? 'Add a supply or record a payment to get started.'
            : 'Try another date or date range.'
        }
        ListHeaderComponent={
          <>
            <PartyLedgerHeader
              partyType="SUPPLIER"
              balance={balance}
              moneyOut={supplierSummary.totalPayments}
              moneyIn={supplierSummary.totalSupply}
              filter={filter}
              onFilterChange={setFilter}
              onAddTransaction={handleAddSupply}
              onPayment={handlePayment}
              onShareWhatsApp={handleShareWhatsApp}
              isSharing={isSharing}
            />

            <SupplierProductsLink
              onPress={handleOpenProducts}
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
