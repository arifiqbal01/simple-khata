
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  AppText,
  MoneyInput,
  SaveButton,
  Screen,
} from '@/components/ui';

import { useRecordPayment } from '@/hooks/ledger/useRecordPayment';

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PaymentScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    ledgerFrom?: string | string[];
  }>();

  const customerId = firstParam(params.id);
  const from = firstParam(params.from);
  const ledgerFrom = firstParam(params.ledgerFrom);

  const {
    customer,
    balance,
    amount,
    setAmount,
    loading,
    saving,
    error,
    parsedAmount,
    validAmount,
    remainingBalance,
    isOverpayment,
    payFull,
    save,
  } = useRecordPayment(customerId);

  const [saveError, setSaveError] = useState<
    string | null
  >(null);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();

    if (from === 'ledger' && customerId) {
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
  }, [customerId, from, ledgerFrom]);

  const handleSave = useCallback(async () => {
    if (!validAmount || saving) return;

    setSaveError(null);

    try {
      const saved = await save();

      if (saved) {
        handleClose();
      }
    } catch (cause) {
      setSaveError(
        cause instanceof Error
          ? cause.message
          : 'Could not record payment'
      );
    }
  }, [
    validAmount,
    saving,
    save,
    handleClose,
  ]);

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
        <View className="flex-row items-center border-b border-border py-3">
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#242422"
            />
          </Pressable>

          <AppText className="ml-3 flex-1 font-spline-semibold text-[17px] text-foreground">
            Payment
          </AppText>
        </View>

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {error ?? 'Customer could not be loaded.'}
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
        {/* Header */}
        <View className="flex-row items-center border-b border-border py-3">
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#242422"
            />
          </Pressable>

          <AppText className="ml-3 flex-1 font-spline-semibold text-[17px] text-foreground">
            Payment
          </AppText>

          <SaveButton
              loading={saving}
              disabled={!validAmount}
              onPress={() => {
                void handleSave();
              }}
            />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Customer */}
          <View className="pt-5">
            <AppText className="font-spline-semibold text-[13px] uppercase leading-[18px] text-muted">
              Receiving from
            </AppText>

            <AppText className="mt-3 font-spline-bold text-[30px] leading-[38px] text-foreground">
              {customer.name}
            </AppText>

            <View className="mt-3 flex-row items-baseline">
              <AppText className="font-sans text-[17px] leading-[24px] text-muted">
                Outstanding:
              </AppText>

              <AppText className="ml-1.5 font-spline-semibold text-[18px] leading-[24px] text-foreground">
                Rs {balance.toLocaleString()}
              </AppText>
            </View>
          </View>

          {/* Payment amount */}
          <View className="mt-12">
            <MoneyInput
              label="Payment amount"
              value={amount}
              onChangeText={(value) => {
                setAmount(value);

                if (saveError) {
                  setSaveError(null);
                }
              }}
              autoFocus
            />

            {/* Pay full */}
            {balance > 0 ? (
              <Pressable
                onPress={() => {
                  payFull();
                  setSaveError(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Pay full balance of Rs ${balance.toLocaleString()}`}
                className="mt-5 min-h-12 flex-row items-center self-start rounded-full bg-chip px-4 active:opacity-70"
              >
                <AppText className="font-spline-medium text-[16px] leading-[22px] text-foreground">
                  Pay full
                </AppText>

                <AppText className="ml-2 font-sans text-[16px] leading-[22px] text-muted">
                  Rs {balance.toLocaleString()}
                </AppText>
              </Pressable>
            ) : null}
          </View>

          {/* Remaining balance */}
          <View className="mt-6">
            <View className="flex-row items-baseline self-start rounded-control bg-chip px-4 py-3">
              <AppText className="font-sans text-[16px] leading-[22px] text-muted">
                Remaining balance:
              </AppText>

              <AppText
                className={`ml-1.5 font-spline-semibold text-[17px] leading-[23px] ${
                  remainingBalance <= 0
                    ? 'text-payment'
                    : 'text-foreground'
                }`}
              >
                Rs {remainingBalance.toLocaleString()}
              </AppText>
            </View>

            {isOverpayment ? (
              <AppText
                variant="caption"
                className="mt-2 text-payment"
              >
                Payment is greater than the current
                outstanding balance.
              </AppText>
            ) : null}
          </View>

          {/* Save errors */}
          {saveError ? (
            <View className="mt-6 rounded-xl border border-udhaar/20 bg-udhaar/5 px-4 py-3">
              <AppText className="text-[14px] text-udhaar">
                {saveError}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
