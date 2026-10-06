import React, {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { AppHeader } from '@/components/layout';
import {
  AppText,
  Button,
  MoneyInput,
  Screen,
} from '@/components/ui';
import { CustomerRepository } from '@/repositories/customer';
import { DeviceRepository } from '@/repositories/device';
import { LedgerRepository } from '@/repositories/ledger';
import { ShopRepository } from '@/repositories/shop';
import { GetCustomerBalanceService } from '@/services/ledger/get-balance';
import { RecordPaymentService } from '@/services/ledger/record-payment';
import type { Customer } from '@/types/domain';

const customerRepository = new CustomerRepository();
const deviceRepository = new DeviceRepository();
const ledgerRepository = new LedgerRepository();
const shopRepository = new ShopRepository();

const recordPaymentService =
  new RecordPaymentService(
    ledgerRepository,
    customerRepository
  );

const getCustomerBalanceService =
  new GetCustomerBalanceService(
    ledgerRepository,
    customerRepository
  );

export default function PaymentScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    ledgerFrom?: string | string[];
  }>();

  const customerId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const from = Array.isArray(params.from)
    ? params.from[0]
    : params.from;

  const ledgerFrom = Array.isArray(
    params.ledgerFrom
  )
    ? params.ledgerFrom[0]
    : params.ledgerFrom;

  const [shopId, setShopId] = useState<
    string | null
  >(null);

  const [deviceId, setDeviceId] = useState<
    string | null
  >(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
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

        const device =
          await deviceRepository.getFirstByShop(
            shop.id
          );

        if (!device) {
          throw new Error(
            'Device has not been initialized'
          );
        }

        const currentCustomer =
          await customerRepository.getByIdAndShop(
            customerId,
            shop.id
          );

        if (!currentCustomer) {
          throw new Error(
            'Customer not found'
          );
        }

        const currentBalance =
          await getCustomerBalanceService.execute({
            shopId: shop.id,
            customerId,
          });

        if (cancelled) {
          return;
        }

        setShopId(shop.id);
        setDeviceId(device.id);
        setCustomer(currentCustomer);
        setBalance(currentBalance);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Could not initialize Payment screen';

        Alert.alert(
          'Could not load customer',
          message
        );

        console.error(
          'Failed to initialize Payment screen:',
          error
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
  }, [customerId]);

  const parsedAmount = Number(
    amount.trim()
  );

  const validAmount =
    Number.isSafeInteger(parsedAmount) &&
    parsedAmount > 0;

  const remainingBalance = validAmount
    ? balance - parsedAmount
    : balance;

  function handleClose() {
    if (
      from === 'ledger' &&
      customerId
    ) {
      router.replace({
        pathname: '/customer/[id]',
        params: {
          id: customerId,
          from: ledgerFrom ?? 'home',
        },
      });

      return;
    }

    if (from === 'customers') {
      router.replace('/customers');
      return;
    }

    router.replace('/');
  }

  function handlePayFull() {
    if (balance <= 0) {
      return;
    }

    setAmount(String(balance));
  }

  async function handleSave() {
    if (
      !customerId ||
      !shopId ||
      !deviceId ||
      saving
    ) {
      return;
    }

    if (!Number.isSafeInteger(parsedAmount)) {
      Alert.alert(
        'Invalid amount',
        'Enter a whole rupee amount.'
      );

      return;
    }

    if (parsedAmount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Amount must be greater than zero.'
      );

      return;
    }

    try {
      setSaving(true);

      await recordPaymentService.execute({
        shopId,
        customerId,
        deviceId,
        amount: parsedAmount,
      });

      handleClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not record payment';

      Alert.alert(
        'Could not record payment',
        message
      );

      console.error(
        'Failed to record payment:',
        error
      );
    } finally {
      setSaving(false);
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
          title="Payment"
          showBack
          onBackPress={handleClose}
        />

        <View className="flex-1 items-center justify-center px-5">
          <AppText
            variant="body"
            className="text-center text-udhaar"
          >
            Customer could not be loaded.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <Screen>
        <AppHeader
          title="Payment"
          showBack
          onBackPress={handleClose}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Customer */}
          <View className="pt-5">
            <AppText
              className="
                font-spline-semibold
                text-[13px]
                uppercase
                leading-[18px]
                text-muted
              "
            >
              Receiving from
            </AppText>

            <AppText
              className="
                mt-3
                font-spline-bold
                text-[30px]
                leading-[38px]
                text-foreground
              "
            >
              {customer.name}
            </AppText>

            <View className="mt-3 flex-row items-baseline">
              <AppText
                className="
                  font-sans
                  text-[17px]
                  leading-[24px]
                  text-muted
                "
              >
                Outstanding:
              </AppText>

              <AppText
                className="
                  ml-1.5
                  font-spline-semibold
                  text-[18px]
                  leading-[24px]
                  text-foreground
                "
              >
                Rs {balance.toLocaleString()}
              </AppText>
            </View>
          </View>

          {/* Payment amount */}
          <View className="mt-12">
            <MoneyInput
              label="Payment amount"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />

            {/* Pay full */}
            {balance > 0 ? (
              <Pressable
                onPress={handlePayFull}
                accessibilityRole="button"
                accessibilityLabel={`Pay full balance of Rs ${balance.toLocaleString()}`}
                className="
                  mt-5
                  min-h-12
                  flex-row
                  items-center
                  self-start
                  rounded-full
                  bg-chip
                  px-4
                  active:opacity-70
                "
              >
                <AppText
                  className="
                    font-spline-medium
                    text-[16px]
                    leading-[22px]
                    text-foreground
                  "
                >
                  Pay full
                </AppText>

                <AppText
                  className="
                    ml-2
                    font-sans
                    text-[16px]
                    leading-[22px]
                    text-muted
                  "
                >
                  Rs {balance.toLocaleString()}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          {/* Remaining balance */}
          <View className="mt-6">
            <View
              className="
                flex-row
                items-baseline
                self-start
                rounded-control
                bg-chip
                px-4
                py-3
              "
            >
              <AppText
                className="
                  font-sans
                  text-[16px]
                  leading-[22px]
                  text-muted
                "
              >
                Remaining balance:
              </AppText>

              <AppText
                className={`
                  ml-1.5
                  font-spline-semibold
                  text-[17px]
                  leading-[23px]
                  ${
                    remainingBalance <= 0
                      ? 'text-payment'
                      : 'text-foreground'
                  }
                `}
              >
                Rs{' '}
                {remainingBalance.toLocaleString()}
              </AppText>
            </View>

            {validAmount &&
            parsedAmount > balance ? (
              <AppText
                variant="caption"
                className="mt-2 text-payment"
              >
                Payment is greater than the
                current outstanding balance.
              </AppText>
            ) : null}
          </View>
        </ScrollView>

        {/* Save */}
        <View className="border-t border-border bg-background pb-5 pt-3">
          <Button
            label={
              validAmount
                ? `Record Rs ${parsedAmount.toLocaleString()}`
                : 'Record Payment'
            }
            loading={saving}
            disabled={!validAmount}
            onPress={handleSave}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}