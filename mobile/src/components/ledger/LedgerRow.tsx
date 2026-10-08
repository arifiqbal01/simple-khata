
import React from 'react';

import {
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

import type {
  LedgerHistoryEntry,
} from '@/repositories/ledger';

export interface LedgerRowProps {
  entry: LedgerHistoryEntry;
  onDelete?: (
    entry: LedgerHistoryEntry
  ) => void | Promise<void>;
  isDeleting?: boolean;
}

export function LedgerRow({
  entry,
  onDelete,
  isDeleting = false,
}: LedgerRowProps) {
  const isUdhaar = entry.type === 'UDHAAR';

  function handleDelete(): void {
    if (!onDelete || isDeleting) {
      return;
    }

    // The parent screen handles:
    // 1. Confirmation modal
    // 2. Offline-first deletion
    // 3. Success/error toast
    void onDelete(entry);
  }

  return (
    <View
      className="
        min-h-[86px]
        flex-row
        items-center
        border-b
        border-border
        py-4
      "
    >
      <View className="min-w-0 flex-1 pr-3">
        <AppText
          numberOfLines={2}
          className="
            font-spline-semibold
            text-[17px]
            leading-[23px]
            text-foreground
          "
        >
          {getEntryTitle(entry)}
        </AppText>

        <AppText
          className="
            mt-0.5
            font-sans
            text-[15px]
            leading-[20px]
            text-muted
          "
        >
          {formatEntryTime(entry.occurred_at)}
        </AppText>
      </View>

      <AppText
        numberOfLines={1}
        className={`
          font-spline-semibold
          text-[18px]
          leading-[24px]
          ${
            isUdhaar
              ? 'text-udhaar'
              : 'text-payment'
          }
        `}
      >
        {isUdhaar ? '+' : '−'} Rs{' '}
        {entry.amount.toLocaleString()}
      </AppText>

      {onDelete ? (
        <Pressable
          onPress={handleDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={
            `Delete ${
              isUdhaar ? 'Udhaar' : 'Payment'
            } of Rs ${entry.amount}`
          }
          accessibilityState={{
            disabled: isDeleting,
            busy: isDeleting,
          }}
          hitSlop={8}
          className="
            ml-3
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
          "
          style={{
            opacity: isDeleting ? 0.4 : 1,
          }}
        >
          <Ionicons
            name="trash-outline"
            size={21}
            color="#DC2626"
          />
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
