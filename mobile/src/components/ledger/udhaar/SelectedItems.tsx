
import { memo } from 'react';

import {
  Pressable,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { ItemUnitPicker } from '@/components/item/ItemUnitPicker';

import type {
  DraftUdhaarItem,
} from '@/hooks/ledger/useAddUdhaar';

interface SelectedItemsProps {
  items: DraftUdhaarItem[];

  onRemove: (id: string) => void;

  onChangeQuantity: (
    id: string,
    quantity: string
  ) => void;

  onChangeUnit: (
    id: string,
    unit: string
  ) => void;

  onChangeUnitPrice: (
    id: string,
    unitPrice: string
  ) => void;
}

export const SelectedItems = memo(
  function SelectedItems({
    items,
    onRemove,
    onChangeQuantity,
    onChangeUnit,
    onChangeUnitPrice,
  }: SelectedItemsProps) {
    if (items.length === 0) {
      return (
        <AppText className="mt-3 text-[13px] text-muted">
          Select a quick item or search to add one.
        </AppText>
      );
    }

    const total = items.reduce(
      (sum, item) => {
        const quantity = Number(item.quantity);
        const price = Number(item.unitPrice);

        if (
          !Number.isFinite(quantity) ||
          !Number.isFinite(price) ||
          quantity <= 0 ||
          price < 0
        ) {
          return sum;
        }

        return sum + quantity * price;
      },
      0
    );

    return (
      <View className="mt-3">
        <View className="flex-row items-center justify-between border-b border-border pb-2">
          <AppText className="text-[13px] text-muted">
            Selected items ({items.length})
          </AppText>

          <AppText className="font-spline-medium text-[13px] text-foreground">
            Rs {total.toLocaleString('en-PK')}
          </AppText>
        </View>

        {items.map((item) => {
          const quantity = Number(item.quantity);
          const price = Number(item.unitPrice);

          const validLine =
            item.quantity.trim().length > 0 &&
            item.unit.trim().length > 0 &&
            item.unitPrice.trim().length > 0 &&
            Number.isInteger(quantity) &&
            quantity > 0 &&
            Number.isInteger(price) &&
            price >= 0;

          const lineTotal = validLine
            ? quantity * price
            : null;

          return (
            <View
              key={item.id}
              className="border-b border-border py-3"
            >
              <View className="mb-3 flex-row items-center justify-between">
                <AppText
                  numberOfLines={1}
                  className="mr-3 flex-1 font-spline-medium text-[15px] text-foreground"
                >
                  {item.name}
                </AppText>

                <AppText className="mr-3 font-spline-medium text-[13px] text-foreground">
                  {lineTotal === null
                    ? '—'
                    : `Rs ${lineTotal.toLocaleString('en-PK')}`}
                </AppText>

                <Pressable
                  onPress={() => onRemove(item.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color="#777770"
                  />
                </Pressable>
              </View>

              <View className="flex-row items-center gap-2">
                <TextInput
                  value={item.quantity}
                  onChangeText={(value) =>
                    onChangeQuantity(item.id, value)
                  }
                  keyboardType="number-pad"
                  placeholder="Qty"
                  placeholderTextColor="#9A9A93"
                  selectTextOnFocus
                  accessibilityLabel={`${item.name} quantity`}
                  className="h-11 w-16 rounded-xl border border-border bg-surface px-2 text-center text-[14px] text-foreground"
                />

                <View className="min-w-0 flex-1">
                  <ItemUnitPicker
                    value={item.unit}
                    onChange={(value) =>
                      onChangeUnit(item.id, value)
                    }
                    compact
                  />
                </View>

                <AppText className="text-[14px] text-muted">
                  ×
                </AppText>

                <TextInput
                  value={item.unitPrice}
                  onChangeText={(value) =>
                    onChangeUnitPrice(item.id, value)
                  }
                  keyboardType="number-pad"
                  placeholder="Price"
                  placeholderTextColor="#9A9A93"
                  selectTextOnFocus
                  accessibilityLabel={`${item.name} selling price`}
                  className="h-11 w-24 rounded-xl border border-border bg-surface px-3 text-[14px] text-foreground"
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  }
);
