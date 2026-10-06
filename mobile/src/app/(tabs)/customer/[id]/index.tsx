import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  SectionList,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

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
import { CustomerRepository } from '@/repositories/customer';
import {
  LedgerRepository,
  type LedgerHistoryEntry,
} from '@/repositories/ledger';
import { ShopRepository } from '@/repositories/shop';
import { GetCustomerBalanceService } from '@/services/ledger/get-balance';
import { GetLedgerHistoryService } from '@/services/ledger/get-history';
import type { Customer } from '@/types/domain';

const customerRepository = new CustomerRepository();
const ledgerRepository = new LedgerRepository();
const shopRepository = new ShopRepository();

const getBalanceService =
  new GetCustomerBalanceService(
    ledgerRepository,
    customerRepository
  );

const getHistoryService =
  new GetLedgerHistoryService(
    ledgerRepository,
    customerRepository
  );

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

  const [shopId, setShopId] = useState<
    string | null
  >(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [entries, setEntries] = useState<
    LedgerHistoryEntry[]
  >([]);

  const [balance, setBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const sections = useMemo(
    () => groupLedgerEntries(entries),
    [entries]
  );

  const loadLedger = useCallback(
    async (
      currentShopId: string,
      showRefreshing = false
    ) => {
      if (!customerId) {
        return;
      }

      if (showRefreshing) {
        setRefreshing(true);
      }

      try {
        setError(null);

        const currentCustomer =
          await customerRepository.getByIdAndShop(
            customerId,
            currentShopId
          );

        if (!currentCustomer) {
          throw new Error(
            `Customer not found: ${customerId}`
          );
        }

        const [currentBalance, history] =
          await Promise.all([
            getBalanceService.execute({
              shopId: currentShopId,
              customerId,
            }),

            getHistoryService.execute({
              shopId: currentShopId,
              customerId,
            }),
          ]);

        setCustomer(currentCustomer);
        setBalance(currentBalance);
        setEntries(history);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Could not load customer ledger';

        setError(message);

        console.error(
          'Failed to load customer ledger:',
          loadError
        );
      } finally {
        if (showRefreshing) {
          setRefreshing(false);
        }
      }
    },
    [customerId]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        if (!customerId) {
          throw new Error(
            'Customer ID is missing'
          );
        }

        const shop =
          await shopRepository.getFirst();

        if (!shop) {
          throw new Error(
            'Shop has not been initialized'
          );
        }

        if (cancelled) {
          return;
        }

        setShopId(shop.id);

        await loadLedger(shop.id);
      } catch (initializeError) {
        if (cancelled) {
          return;
        }

        const message =
          initializeError instanceof Error
            ? initializeError.message
            : 'Could not initialize customer ledger';

        setError(message);

        console.error(
          'Failed to initialize customer ledger:',
          initializeError
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [customerId, loadLedger]);

  useFocusEffect(
    useCallback(() => {
      if (!shopId || loading) {
        return;
      }

      loadLedger(shopId);
    }, [shopId, loading, loadLedger])
  );

  async function handleRefresh() {
    if (!shopId || refreshing) {
      return;
    }

    await loadLedger(shopId, true);
  }

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
          <LedgerRow entry={item} />
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