
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export interface SupplierProductRowData {
  id: string;
  itemId: string;
  itemName: string;
  unit: string | null;
  unitPrice: number;
}

export interface SupplierProductRowProps {
  product: SupplierProductRowData;
  first?: boolean;
  last?: boolean;
  onPress: () => void;
}

export function SupplierProductRow({
  product,
  first = false,
  last = false,
  onPress,
}: SupplierProductRowProps) {
  const unit = product.unit?.trim();

  return (
    <View
      className={`
        min-h-[60px]
        bg-surface
        border-border
        ${first ? 'rounded-t-[12px]' : ''}
        ${last ? 'rounded-b-[12px]' : ''}
        ${!last ? 'border-b' : ''}
      `}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${product.itemName} purchase price`}
        className="
          min-h-[60px]
          flex-row
          items-center
          px-3
          py-2
          active:opacity-70
        "
      >
        <View
          className="
            h-8
            w-8
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
              text-[14px]
              text-foreground
            "
          >
            {product.itemName}
          </AppText>

          <AppText
            numberOfLines={1}
            className="mt-1 text-[12px] text-muted"
          >
            {unit ? `Per ${unit}` : 'No unit'}
          </AppText>
        </View>

        <AppText
          numberOfLines={1}
          className="
            ml-3
            font-spline-semibold
            text-[14px]
            text-foreground
          "
        >
          Rs {formatRupees(product.unitPrice)}
        </AppText>

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
