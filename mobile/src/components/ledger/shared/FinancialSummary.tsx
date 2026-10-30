
import React, { useState } from 'react';
import {
  Pressable,
  useColorScheme,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

type SummaryVariant = 'home' | 'customer' | 'supplier';
type SummaryAppearance = 'light' | 'dark';

interface FinancialSummaryProps {
  variant?: SummaryVariant;

  showHideButton?: boolean;
  appearance?: SummaryAppearance;

  title?: string;
  balanceLabel?: string;
  balance: number;

  leftLabel: string;
  leftAmount: number;

  rightLabel: string;
  rightAmount: number;

  leftDirection?: 'receive' | 'pay';
  rightDirection?: 'receive' | 'pay';
}

interface SummaryColors {
  background: string;
  border: string;
  heading: string;
  label: string;
  amount: string;
  divider: string;
  receive: string;
  pay: string;
  receiveSoft: string;
  paySoft: string;
  buttonBackground: string;
  topLine: string;
  shadow: string;
}

const NEUTRAL_THEMES: Record<
  SummaryVariant,
  SummaryColors
> = {
  home: {
    background: '#191B1E',
    border: '#383B40',
    heading: '#D6D8DC',
    label: '#B7BBC1',
    amount: '#FFFFFF',
    divider: '#3B3F45',
    receive: '#6ED9A0',
    pay: '#F08F8A',
    receiveSoft: 'rgba(72,190,132,0.14)',
    paySoft: 'rgba(232,115,111,0.14)',
    buttonBackground: '#303338',
    topLine: '#565A60',
    shadow: '#111214',
  },

  customer: {
    background: '#F0F1F2',
    border: '#DADDE0',
    heading: '#45494E',
    label: '#686D73',
    amount: '#17191C',
    divider: '#D6D9DC',
    receive: '#23865C',
    pay: '#C3544D',
    receiveSoft: '#DCEEE4',
    paySoft: '#F6E2E0',
    buttonBackground: '#E3E5E7',
    topLine: '#FFFFFF',
    shadow: '#111214',
  },

  supplier: {
    background: '#F0F1F2',
    border: '#DADDE0',
    heading: '#45494E',
    label: '#686D73',
    amount: '#17191C',
    divider: '#D6D9DC',
    receive: '#23865C',
    pay: '#C3544D',
    receiveSoft: '#DCEEE4',
    paySoft: '#F6E2E0',
    buttonBackground: '#E3E5E7',
    topLine: '#FFFFFF',
    shadow: '#111214',
  },
};

const THEMES: Record<
  SummaryAppearance,
  Record<SummaryVariant, SummaryColors>
> = {
  light: NEUTRAL_THEMES,
  dark: NEUTRAL_THEMES,
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
  colors: SummaryColors;
  compact?: boolean;
}

function SummaryMetric({
  label,
  amount,
  visible,
  direction,
  colors,
  compact = false,
}: SummaryMetricProps) {
  const isReceive = direction === 'receive';

  const accent = isReceive
    ? colors.receive
    : colors.pay;

  const accentBackground = isReceive
    ? colors.receiveSoft
    : colors.paySoft;

  return (
    <View className="min-w-0 flex-1">
      <View
        className={
          compact
            ? 'mb-1 flex-row items-center gap-2'
            : 'mb-2 flex-row items-center gap-2'
        }
      >
        <View
          className={
            compact
              ? 'h-6 w-6 items-center justify-center rounded-full'
              : 'h-7 w-7 items-center justify-center rounded-full'
          }
          style={{
            backgroundColor: accentBackground,
          }}
        >
          <Ionicons
            name={
              isReceive
                ? 'arrow-down-outline'
                : 'arrow-up-outline'
            }
            size={compact ? 15 : 17}
            color={accent}
          />
        </View>

        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          className="min-w-0 flex-1 font-spline-medium"
          style={{
            color: colors.label,
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
          color: colors.amount,
          fontSize: compact ? 17 : 18,
          lineHeight: compact ? 23 : 25,
          fontVariant: ['tabular-nums'],
        }}
      >
        {visible
          ? formatAmount(Math.max(0, safeAmount(amount)))
          : 'Rs ••••••'}
      </AppText>
    </View>
  );
}

export function FinancialSummary({
  variant = 'home',
  showHideButton = false,
  appearance,
  title,
  balanceLabel,
  balance,
  leftLabel,
  leftAmount,
  rightLabel,
  rightAmount,
  leftDirection = 'receive',
  rightDirection = 'pay',
}: FinancialSummaryProps) {
  const systemAppearance = useColorScheme();

  const activeAppearance =
    appearance ??
    (systemAppearance === 'dark' ? 'dark' : 'light');

  const colors = THEMES[activeAppearance][variant];

  const [amountsVisible, setAmountsVisible] =
    useState(true);

  const visible = !showHideButton || amountsVisible;

  const defaultTitle =
    variant === 'home'
      ? 'FINANCIAL OVERVIEW'
      : variant === 'customer'
        ? 'CUSTOMER OVERVIEW'
        : 'SUPPLIER OVERVIEW';

  const defaultBalanceLabel =
    variant === 'home'
      ? 'Total Outstanding'
      : 'Net Balance';

  const resolvedTitle = title ?? defaultTitle;

  const hasHeading =
    resolvedTitle.trim().length > 0;

  // Compact layout is enabled when the title is hidden.
  const compact = !hasHeading && !showHideButton;

  const headingIcon =
    variant === 'home'
      ? 'wallet-outline'
      : variant === 'customer'
        ? 'people-outline'
        : 'storefront-outline';

  return (
    <View
      className={
        compact
          ? 'pb-3 pt-1'
          : 'pb-6 pt-3'
      }
    >
      <View
        className="overflow-hidden rounded-[28px]"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 1,
          shadowColor: colors.shadow,
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity:
            activeAppearance === 'dark'
              ? 0.16
              : 0.12,
          shadowRadius: 18,
          elevation: 5,
        }}
      >
        {/* Subtle top highlight */}
        <View
          style={{
            height: 1,
            backgroundColor: colors.topLine,
            opacity: 0.65,
          }}
        />

        <View
          className={
            compact
              ? 'px-5 pb-4 pt-4'
              : 'px-5 pb-5 pt-5'
          }
        >
          {/* Heading and privacy button */}
          {(hasHeading || showHideButton) && (
            <View className="flex-row items-center justify-between">
              {hasHeading ? (
                <View className="min-w-0 flex-1 flex-row items-center gap-2">
                  <Ionicons
                    name={headingIcon}
                    size={17}
                    color={colors.heading}
                  />

                  <AppText
                    numberOfLines={1}
                    className="font-spline-medium"
                    style={{
                      color: colors.heading,
                      fontSize: 11,
                      lineHeight: 16,
                      letterSpacing: 1.2,
                    }}
                  >
                    {resolvedTitle}
                  </AppText>
                </View>
              ) : null}

              {showHideButton && (
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
                    backgroundColor:
                      colors.buttonBackground,
                  }}
                >
                  <Ionicons
                    name={
                      amountsVisible
                        ? 'eye-outline'
                        : 'eye-off-outline'
                    }
                    size={19}
                    color={colors.heading}
                  />
                </Pressable>
              )}
            </View>
          )}

          {/* Main balance */}
          <View
            className={
              compact
                ? 'flex-row items-center justify-between gap-3'
                : 'mt-5 flex-row items-center justify-between gap-3'
            }
          >
            <AppText
              numberOfLines={1}
              className="shrink-0 font-spline-medium"
              style={{
                color: colors.label,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {balanceLabel ?? defaultBalanceLabel}
            </AppText>

            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              className="min-w-0 flex-1 text-right font-spline-bold"
              style={{
                color: colors.amount,
                fontSize: compact ? 23 : 24,
                lineHeight: compact ? 30 : 33,
                fontVariant: ['tabular-nums'],
                textAlign: 'right',
              }}
            >
              {visible
                ? formatAmount(balance)
                : 'Rs ••••••'}
            </AppText>
          </View>

          {/* Horizontal divider */}
          <View
            className={
              compact
                ? 'mb-3 mt-3'
                : 'mb-4 mt-5'
            }
            style={{
              height: 1,
              backgroundColor: colors.divider,
            }}
          />

          {/* Bottom metrics */}
          <View className="flex-row">
            <SummaryMetric
              label={leftLabel}
              amount={leftAmount}
              visible={visible}
              direction={leftDirection}
              colors={colors}
              compact={compact}
            />

            <View
              className={
                compact
                  ? 'mx-3 self-stretch'
                  : 'mx-4 self-stretch'
              }
              style={{
                width: 1,
                backgroundColor: colors.divider,
              }}
            />

            <SummaryMetric
              label={rightLabel}
              amount={rightAmount}
              visible={visible}
              direction={rightDirection}
              colors={colors}
              compact={compact}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
