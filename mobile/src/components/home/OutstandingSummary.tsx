
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

interface OutstandingSummaryProps {
  toReceive?: number;
  toPay?: number;

  // Legacy props.
  amount?: number;
  moneyOut?: number;
  moneyIn?: number;
}

const COLORS = {
  background: '#191B1E',
  border: '#383B40',
  heading: '#D6D8DC',
  label: '#B7BBC1',
  amount: '#FFFFFF',
  divider: '#3B3F45',
  receive: '#6ED9A0',
  pay: '#F08F8A',
};

function safeAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function formatAmount(value: number): string {
  const amount = safeAmount(value);

  return `${amount < 0 ? '− ' : ''}Rs ${formatRupees(
    Math.abs(amount)
  )}`;
}

interface SummaryMetricProps {
  label: string;
  amount: number;
  visible: boolean;
  direction: 'receive' | 'pay';
}

function SummaryMetric({
  label,
  amount,
  visible,
  direction,
}: SummaryMetricProps) {
  const isReceive = direction === 'receive';

  return (
    <View className="min-w-0 flex-1">
      <View className="mb-2 flex-row items-center gap-2">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{
            backgroundColor: isReceive
              ? 'rgba(72,190,132,0.14)'
              : 'rgba(232,115,111,0.14)',
          }}
        >
          <Ionicons
            name={
              isReceive
                ? 'arrow-down-outline'
                : 'arrow-up-outline'
            }
            size={17}
            color={
              isReceive
                ? COLORS.receive
                : COLORS.pay
            }
          />
        </View>

        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          className="min-w-0 flex-1 font-spline-medium"
          style={{
            color: COLORS.label,
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {label}
        </AppText>
      </View>

      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        className="font-spline-semibold"
        style={{
          color: COLORS.amount,
          fontSize: 18,
          lineHeight: 25,
          fontVariant: ['tabular-nums'],
        }}
      >
        {visible
          ? formatAmount(
              Math.max(0, safeAmount(amount))
            )
          : 'Rs ••••••'}
      </AppText>
    </View>
  );
}

export function OutstandingSummary({
  toReceive,
  toPay,
  amount = 0,
  moneyOut = 0,
  moneyIn = 0,
}: OutstandingSummaryProps) {
  const [amountsVisible, setAmountsVisible] =
    useState(true);

  const isPartySummary =
    toReceive !== undefined ||
    toPay !== undefined;

  const receivable = Math.max(
    0,
    safeAmount(toReceive ?? 0)
  );

  const payable = Math.max(
    0,
    safeAmount(toPay ?? 0)
  );

  const netBalance = isPartySummary
    ? receivable - payable
    : safeAmount(amount);

  return (
    <View className="pb-6 pt-3">
      <View
        className="overflow-hidden rounded-[28px]"
        style={{
          backgroundColor: COLORS.background,
          borderColor: COLORS.border,
          borderWidth: 1,
          shadowColor: '#111214',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.16,
          shadowRadius: 18,
          elevation: 5,
        }}
      >
        <View
          style={{
            height: 1,
            backgroundColor: '#565A60',
            opacity: 0.65,
          }}
        />

        <View className="px-5 pb-5 pt-5">
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <Ionicons
                name="wallet-outline"
                size={17}
                color={COLORS.heading}
              />

              <AppText
                numberOfLines={1}
                className="font-spline-medium"
                style={{
                  color: COLORS.heading,
                  fontSize: 11,
                  lineHeight: 16,
                  letterSpacing: 1.2,
                }}
              >
                FINANCIAL OVERVIEW
              </AppText>
            </View>

            <Pressable
              onPress={() =>
                setAmountsVisible(
                  (previous) => !previous
                )
              }
              accessibilityRole="button"
              accessibilityLabel={
                amountsVisible
                  ? 'Hide financial amounts'
                  : 'Show financial amounts'
              }
              accessibilityState={{
                checked: amountsVisible,
              }}
              hitSlop={8}
              className="ml-3 h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: '#303338',
              }}
            >
              <Ionicons
                name={
                  amountsVisible
                    ? 'eye-outline'
                    : 'eye-off-outline'
                }
                size={19}
                color="#D6D8DC"
              />
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-between gap-3">
            <AppText
              numberOfLines={1}
              className="shrink-0 font-spline-medium"
              style={{
                color: COLORS.label,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {isPartySummary
                ? 'Net Balance'
                : 'Total Outstanding'}
            </AppText>

            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              className="min-w-0 flex-1 text-right font-spline-bold"
              style={{
                color: COLORS.amount,
                fontSize: 24,
                lineHeight: 33,
                fontVariant: ['tabular-nums'],
                textAlign: 'right',
              }}
            >
              {amountsVisible
                ? formatAmount(netBalance)
                : 'Rs ••••••'}
            </AppText>
          </View>

          <View
            className="mb-4 mt-5"
            style={{
              height: 1,
              backgroundColor: COLORS.divider,
            }}
          />

          <View className="flex-row">
            <SummaryMetric
              label={
                isPartySummary
                  ? 'To Receive'
                  : 'Money Out'
              }
              amount={
                isPartySummary
                  ? receivable
                  : moneyOut
              }
              visible={amountsVisible}
              direction="receive"
            />

            <View
              className="mx-4 self-stretch"
              style={{
                width: 1,
                backgroundColor: '#34383E',
              }}
            />

            <SummaryMetric
              label={
                isPartySummary
                  ? 'To Pay'
                  : 'Money In'
              }
              amount={
                isPartySummary
                  ? payable
                  : moneyIn
              }
              visible={amountsVisible}
              direction={
                isPartySummary
                  ? 'pay'
                  : 'receive'
              }
            />
          </View>
        </View>
      </View>
    </View>
  );
}
