
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

import {
  usePartyPayment,
} from '@/hooks/ledger/usePartyPayment';

type PartyType = 'CUSTOMER' | 'SUPPLIER';

interface PartyPaymentFormProps {
  partyType: PartyType;
}

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function PartyPaymentForm({
  partyType,
}: PartyPaymentFormProps) {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    ledgerFrom?: string | string[];
  }>();

  const partyId = firstParam(params.id);
  const from = firstParam(params.from);
  const ledgerFrom = firstParam(params.ledgerFrom);

  const isSupplier = partyType === 'SUPPLIER';

  const {
    party,
    balance,
    amount,
    setAmount,
    loading,
    saving,
    error,
    validAmount,
    remainingBalance,
    isOverpayment,
    payFull,
    save,
  } = usePartyPayment(partyId, partyType);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();

    if (from === 'ledger' && partyId) {
      if (isSupplier) {
        router.replace({
          pathname: '/suppliers/[id]',
          params: {
            id: partyId,
            from: ledgerFrom ?? 'suppliers',
          },
        });
      } else {
        router.replace({
          pathname: '/customer/[id]',
          params: {
            id: partyId,
            from: ledgerFrom ?? 'home',
          },
        });
      }

      return;
    }

    if (isSupplier) {
      router.replace('/suppliers');
    } else if (from === 'customers') {
      router.replace('/customer');
    } else {
      router.replace('/');
    }
  }, [partyId, from, ledgerFrom, isSupplier]);

  const handleSave = useCallback(async () => {
    if (!validAmount || saving) return;

    setSaveError(null);
    Keyboard.dismiss();

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

  if (!party) {
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
            {error ??
              `${isSupplier ? 'Supplier' : 'Customer'} could not be loaded.`}
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
            disabled={saving}
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
            {isSupplier ? 'Pay Supplier' : 'Payment'}
          </AppText>

          <SaveButton
            loading={saving}
            disabled={!validAmount || saving}
            onPress={() => {
              void handleSave();
            }}
          />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Party details */}
          <View className="pt-5">
            <AppText className="font-spline-semibold text-[13px] uppercase leading-[18px] text-muted">
              {isSupplier ? 'Paying to' : 'Receiving from'}
            </AppText>

            <AppText className="mt-3 font-spline-bold text-[30px] leading-[38px] text-foreground">
              {party.name}
            </AppText>

            <View className="mt-3 flex-row items-baseline">
              <AppText className="font-sans text-[17px] leading-[24px] text-muted">
                {isSupplier ? 'Payable:' : 'Outstanding:'}
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
                if (saveError) setSaveError(null);
              }}
              autoFocus
            />

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
                Payment is greater than the current{' '}
                {isSupplier
                  ? 'payable balance.'
                  : 'outstanding balance.'}
              </AppText>
            ) : null}
          </View>

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
