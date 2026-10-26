
import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

import type {
  LedgerHistoryWithBalance,
} from '@/repositories/ledger/ledger-history';

export interface LedgerRowProps {
  entry: LedgerHistoryWithBalance;

  selected?: boolean;
  onPress?: () => void;

  onDelete?: (
    entry: LedgerHistoryWithBalance
  ) => void | Promise<void>;

  isDeleting?: boolean;
}

export function LedgerRow({
  entry,
  selected = false,
  onPress,
  onDelete,
  isDeleting = false,
}: LedgerRowProps) {
  const isPayment = entry.type === 'PAYMENT';
  const isIncrease = !isPayment;

  const title = getEntryTitle(entry);

  const hasBalance =
    typeof entry.balance_after === 'number' &&
    Number.isFinite(entry.balance_after);

  const formattedAmount = formatRupees(entry.amount);

  const formattedBalance = hasBalance
    ? formatRupees(entry.balance_after)
    : null;

  function handleDelete(): void {
    if (!onDelete || isDeleting) {
      return;
    }

    // Parent handles confirmation and deletion.
    void onDelete(entry);
  }

  return (
    <View
      className={`min-h-[80px] flex-row items-center border-b border-border ${
        selected ? 'bg-surface' : ''
      }`}
    >
      {/* Transaction content */}
      <Pressable
        onPress={onPress}
        disabled={!onPress || isDeleting}
        accessibilityRole="button"
        accessibilityLabel={`${title}, Rs ${formattedAmount}`}
        accessibilityState={{
          selected,
          disabled: !onPress || isDeleting,
        }}
        className="min-w-0 flex-1 flex-row items-center py-3"
      >
        {/* Title and date */}
        <View className="min-w-0 flex-1 pr-2">
          <AppText
            numberOfLines={2}
            className="font-spline-semibold text-[17px] leading-[23px] text-foreground"
          >
            {title}
          </AppText>

          <AppText
            numberOfLines={1}
            className="mt-1 font-sans text-[12px] leading-[16px] text-muted"
          >
            {formatEntryDateTime(entry.occurred_at)}
          </AppText>
        </View>

        {/* Amount and running balance */}
        <View className="items-end">
          <AppText
            numberOfLines={1}
            className={`font-spline-semibold text-[18px] leading-[24px] ${
              isIncrease
                ? 'text-udhaar'
                : 'text-payment'
            }`}
          >
            {isIncrease ? '+' : '−'} Rs{' '}
            {formattedAmount}
          </AppText>

          {hasBalance ? (
            <AppText
              numberOfLines={1}
              className="mt-1 font-sans text-[12px] leading-[16px] text-muted"
            >
              Balance Rs {formattedBalance}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {/* Delete action */}
      {selected && onDelete ? (
        <Pressable
          onPress={handleDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${getEntryTypeLabel(entry.type)} of Rs ${formattedAmount}`}
          accessibilityState={{
            disabled: isDeleting,
            busy: isDeleting,
          }}
          hitSlop={8}
          className="ml-1 h-9 w-9 items-center justify-center rounded-lg"
          style={{
            opacity: isDeleting ? 0.4 : 1,
          }}
        >
          {isDeleting ? (
            <ActivityIndicator
              size="small"
              color="#DC2626"
            />
          ) : (
            <Ionicons
              name="trash-outline"
              size={16}
              color="#DC2626"
            />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function getEntryTypeLabel(
  type: LedgerHistoryWithBalance['type']
): string {
  switch (type) {
    case 'UDHAAR':
      return 'Udhaar';

    case 'SUPPLY':
      return 'Supply';

    case 'PAYMENT':
      return 'Payment';

    default:
      return 'Transaction';
  }
}

function getEntryTitle(
  entry: LedgerHistoryWithBalance
): string {
  if (entry.type === 'PAYMENT') {
    return 'Payment';
  }

  const itemNames = entry.item_names?.trim();

  return itemNames || getEntryTypeLabel(entry.type);
}

function formatEntryDateTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formattedDate = date.toLocaleDateString(
    'en-PK',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

  const formattedTime = date.toLocaleTimeString(
    'en-PK',
    {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }
  );

  return `${formattedDate} · ${formattedTime}`;
}
