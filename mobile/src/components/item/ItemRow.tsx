
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export interface ItemRowData {
  id: string;
  name: string;
  default_unit: string | null;
  default_selling_price: number | null;
}

export interface ItemRowProps {
  item: ItemRowData;
  first?: boolean;
  last?: boolean;
  onOpenItem: () => void;
}

export function ItemRow({
  item,
  first = false,
  last = false,
  onOpenItem,
}: ItemRowProps) {
  const unit = item.default_unit?.trim();

  return (
    <View
      className={`
        min-h-[64px]
        border-border
        bg-surface
        ${first ? 'rounded-t-[16px]' : ''}
        ${last ? 'rounded-b-[16px]' : ''}
        ${!last ? 'border-b' : ''}
      `}
    >
      <Pressable
        onPress={onOpenItem}
        accessibilityRole="button"
        accessibilityLabel={`Edit item ${item.name}`}
        className="
          min-h-[64px]
          flex-row
          items-center
          px-4
          py-3
          active:opacity-70
        "
      >
        <View
          className="
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-chip
          "
        >
          <Ionicons
            name="cube-outline"
            size={16}
            color="#242422"
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <AppText
            numberOfLines={1}
            className="
              font-spline-semibold
              text-[15px]
              text-foreground
            "
          >
            {item.name}
          </AppText>

          <AppText
            numberOfLines={1}
            className="mt-1 text-[12px] text-muted"
          >
            {unit ? `Per ${unit}` : 'No unit set'}
          </AppText>
        </View>

        <View className="ml-3 shrink-0 items-end">
          <AppText
            numberOfLines={1}
            className="
              font-spline-semibold
              text-[15px]
              text-foreground
            "
          >
            {item.default_selling_price === null
              ? '—'
              : `Rs ${formatRupees(
                  item.default_selling_price
                )}`}
          </AppText>
        </View>

        <Ionicons
          name="chevron-forward"
          size={15}
          color="#9A9A93"
          style={{ marginLeft: 8 }}
        />
      </Pressable>
    </View>
  );
}
