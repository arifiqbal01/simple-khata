
import React, { useMemo } from 'react';

import {
  ActivityIndicator,
  SectionList,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import Toast from 'react-native-toast-message';

import {
  BalanceSummary,
  LedgerRow,
} from '@/components/ledger';

import { AppHeader } from '@/components/layout';

import {
  AppText,
  Button,
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
  useDeleteLedgerEntry,
} from '@/hooks/ledger/useDeleteLedgerEntry';

import { useConfirm } from '@/hooks/ui/useConfirm';

interface LedgerSection {
  title: string;
  data: LedgerHistoryEntry[];
}

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

  // Customer details, balance, history and refresh.
  const {
    shopId,
    customer,
    entries,
    balance,
    loading,
    refreshing,
    error,
    reload,
    refresh,
  } = useCustomerLedger(customerId);

  // Offline-first ledger deletion.
  const {
    deleteEntry,
    isDeleting,
  } = useDeleteLedgerEntry({
    shopId,
    onDeleted: reload,
  });

  // Reusable confirmation modal.
  const {
    confirm,
    confirmProps,
  } = useConfirm();

  const sections = useMemo(
    () => groupLedgerEntries(entries),
    [entries]
  );

  function handleBack() {
    if (from === 'customers') {
      router.replace('/customers');
      return;
    }

    router.replace('/');
  }

  function handleAddUdhaar() {
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
  }

  function handlePayment() {
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
  }

  function handleRefresh() {
    void refresh().catch((refreshError) => {
      console.error(
        '[customer-ledger] refresh failed',
        refreshError
      );

      Toast.show({
        type: 'error',
        text1: 'Refresh failed',
        text2: 'Could not refresh ledger history.',
      });
    });
  }

  async function handleDelete(
    entry: LedgerHistoryEntry
  ) {
    if (isDeleting) {
      return;
    }

    const entryType =
      entry.type === 'UDHAAR'
        ? 'Udhaar'
        : 'Payment';

    const approved = await confirm({
      title: 'Delete ledger entry?',
      message:
        `Are you sure you want to delete this ` +
        `${entryType.toLowerCase()} entry of ` +
        `Rs ${entry.amount.toLocaleString()}? ` +
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

      Toast.show({
        type: 'success',
        text1: 'Entry deleted',
        text2:
          `${entryType} entry removed. ` +
          'Customer balance updated.',
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (deleteError) {
      console.error(
        '[customer-ledger] delete failed',
        deleteError
      );

      Toast.show({
        type: 'error',
        text1: 'Delete failed',
        text2:
          deleteError instanceof Error
            ? deleteError.message
            : 'Could not delete the entry.',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  if (!customer) {
    return (
      <Screen>
        <AppHeader
          title="Customer"
          showBack
          onBackPress={handleBack}
        />

        <View className="flex-1 items-center justify-center px-6">
          <AppText
            variant="body"
            className="text-center text-udhaar"
          >
            {error ?? 'Customer not found.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={customer.name}
        showBack
        onBackPress={handleBack}
      />

      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="pb-8"
        ListHeaderComponent={
          <>
            <BalanceSummary
              balance={balance}
              size="large"
              className="pt-5"
            />

            <View className="mt-5 flex-row gap-3">
              <Button
                label="Add Udhaar"
                onPress={handleAddUdhaar}
                className="flex-1"
                left={
                  <Ionicons
                    name="add"
                    size={22}
                    color="#FFFFFF"
                  />
                }
              />

              <Button
                label="Payment"
                variant="secondary"
                onPress={handlePayment}
                className="flex-1"
                left={
                  <Ionicons
                    name="arrow-down-outline"
                    size={20}
                    color="#181816"
                  />
                }
              />
            </View>

            {error ? (
              <View className="mt-5 rounded-control bg-udhaar-soft px-4 py-3">
                <AppText
                  variant="small"
                  className="text-udhaar"
                >
                  {error}
                </AppText>
              </View>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <SectionLabel className="bg-background pb-2 pt-8">
            {section.title}
          </SectionLabel>
        )}
        renderItem={({ item }) => (
          <LedgerRow
            entry={item}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No transactions yet"
            description="Add udhaar or record a payment to start this customer's history."
            className="py-14"
          />
        }
      />

      <ConfirmModal {...confirmProps} />
    </Screen>
  );
}

function groupLedgerEntries(
  entries: LedgerHistoryEntry[]
): LedgerSection[] {
  const sections: LedgerSection[] = [];

  for (const entry of entries) {
    const title = formatSectionTitle(
      entry.occurred_at
    );

    const existingSection =
      sections[sections.length - 1];

    if (existingSection?.title === title) {
      existingSection.data.push(entry);
      continue;
    }

    sections.push({
      title,
      data: [entry],
    });
  }

  return sections;
}

function formatSectionTitle(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const activityDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const difference =
    today.getTime() - activityDay.getTime();

  const days = Math.floor(
    difference / 86_400_000
  );

  if (days === 0) {
    return 'TODAY';
  }

  if (days === 1) {
    return 'YESTERDAY';
  }

  return date
    .toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase();
}
