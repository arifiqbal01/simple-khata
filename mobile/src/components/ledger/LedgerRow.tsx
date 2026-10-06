import React from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import type { LedgerHistoryEntry } from '@/repositories/ledger';

export interface LedgerRowProps {
  entry: LedgerHistoryEntry;
}

export function LedgerRow({
  entry,
}: LedgerRowProps) {
  const isUdhaar = entry.type === 'UDHAAR';

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
      <View className="min-w-0 flex-1 pr-4">
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