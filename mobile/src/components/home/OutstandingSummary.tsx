
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
              isReceive ? '#6ED9A0' : '#F08F8A'
            }
          />
        </View>

        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          className="min-w-0 flex-1 font-spline-medium text-[12px] text-[#B7B9BD]"
        >
          {label}
        </AppText>
      </View>

      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        className="font-spline-semibold text-[18px] leading-[25px] text-white"
        style={{
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
        className="overflow-hidden rounded-[28px] border border-[#383B40] bg-[#191B1E]"
        style={{
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
        {/* Metallic top highlight */}
        <View
          className="h-px"
          style={{
            backgroundColor: '#565A60',
            opacity: 0.65,
          }}
        />

        <View className="px-5 pb-5 pt-5">
          {/* Card header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="wallet-outline"
                size={17}
                color="#B7BBC1"
              />

              <AppText className="font-spline-medium text-[11px] tracking-[1.2px] text-[#B7BBC1]">
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
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#303338]"
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

          {/* Compact single-line balance */}
          <View className="mt-5 flex-row items-center justify-between gap-3">
            <AppText
              numberOfLines={1}
              className="shrink-0 font-spline-medium text-[14px] text-[#A9ADB3]"
            >
              {isPartySummary
                ? 'Net Balance'
                : 'Total Outstanding'}
            </AppText>

            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              className="min-w-0 flex-1 text-right font-spline-bold text-[25px] leading-[34px] text-white"
              style={{
                fontVariant: ['tabular-nums'],
              }}
            >
              {amountsVisible
                ? formatAmount(netBalance)
                : 'Rs ••••••'}
            </AppText>
          </View>

          {/* Divider */}
          <View
            className="mb-4 mt-5 h-px"
            style={{
              backgroundColor: '#3B3F45',
            }}
          />

          {/* Receive / Pay */}
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
              className="mx-4 w-px self-stretch"
              style={{
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
                isPartySummary ? 'pay' : 'receive'
              }
            />
          </View>
        </View>
      </View>
    </View>
  );
}
