
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
  LedgerHistoryEntry,
} from '@/repositories/ledger';

export interface LedgerRowProps {
  entry: LedgerHistoryEntry & {
    balance_after?: number;
  };

  selected?: boolean;

  onPress?: () => void;

  onDelete?: (
    entry: LedgerHistoryEntry
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
  const isUdhaar = entry.type === 'UDHAAR';

  const hasBalance =
    typeof entry.balance_after === 'number' &&
    Number.isFinite(entry.balance_after);

  const formattedAmount = formatRupees(entry.amount);

  const formattedBalance = hasBalance
    ? formatRupees(entry.balance_after!)
    : null;

  function handleDelete(): void {
    if (!onDelete || isDeleting) {
      return;
    }

    // Confirmation and deletion are handled
    // by the parent screen.
    void onDelete(entry);
  }

  return (
    <View
      className={`min-h-[90px] flex-row items-center border-b border-border ${
        selected ? 'bg-surface' : ''
      }`}
    >
      {/* Tappable transaction content */}
      <Pressable
        onPress={onPress}
        disabled={isDeleting}
        accessibilityRole="button"
        accessibilityLabel={`${getEntryTitle(entry)}, Rs ${formattedAmount}`}
        accessibilityState={{
          selected,
          disabled: isDeleting,
        }}
        className="min-w-0 flex-1 flex-row items-center py-4"
      >
        {/* Transaction details */}
        <View className="min-w-0 flex-1 pr-2">
          <AppText
            numberOfLines={2}
            className="font-spline-semibold text-[17px] leading-[23px] text-foreground"
          >
            {getEntryTitle(entry)}
          </AppText>

          <AppText className="mt-0.5 font-sans text-[15px] leading-[20px] text-muted">
            {formatEntryTime(entry.occurred_at)}
          </AppText>
        </View>

        {/* Amount and historical balance */}
        <View className="items-end">
          <AppText
            numberOfLines={1}
            className={`font-spline-semibold text-[18px] leading-[24px] ${
              isUdhaar
                ? 'text-udhaar'
                : 'text-payment'
            }`}
          >
            {isUdhaar ? '+' : '−'} Rs{' '}
            {formattedAmount}
          </AppText>

          {hasBalance ? (
            <AppText
              numberOfLines={1}
              className="mt-0.5 font-spline-semibold text-[14px] leading-[19px] text-muted"
            >
              Balance Rs{' '}
              {formattedBalance}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {/* Separate delete button: not nested */}
      {selected && onDelete ? (
        <Pressable
          onPress={handleDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${
            isUdhaar ? 'Udhaar' : 'Payment'
          } of Rs ${formattedAmount}`}
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

function getEntryTitle(
  entry: LedgerHistoryEntry
): string {
  if (entry.type === 'PAYMENT') {
    return 'Payment';
  }

  const itemNames = entry.item_names?.trim();

  return itemNames || 'Udhaar';
}

function formatEntryTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
