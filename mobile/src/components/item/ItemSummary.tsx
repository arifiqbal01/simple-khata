
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

export interface ItemSummaryProps {
  totalItems?: number;
  loading?: boolean;
}

export function ItemSummary({
  totalItems = 0,
  loading = false,
}: ItemSummaryProps) {
  const safeTotalItems =
    typeof totalItems === 'number' &&
    Number.isFinite(totalItems) &&
    totalItems >= 0
      ? totalItems
      : 0;

  return (
    <View
      className="
        flex-row
        items-center
        rounded-[12px]
        bg-surface
        px-3
        py-2
      "
    >
      <Ionicons
        name="cube-outline"
        size={16}
        color="#9A9A93"
      />

      <AppText
        className="
          ml-2
          flex-1
          text-[13px]
          text-muted
        "
      >
        Total Items
      </AppText>

      <AppText
        className="
          font-spline-semibold
          text-[16px]
          text-foreground
        "
      >
        {loading
          ? '—'
          : safeTotalItems.toLocaleString()}
      </AppText>
    </View>
  );
}
