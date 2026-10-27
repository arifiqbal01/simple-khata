
import { memo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';

import type {
  DraftUdhaarItem,
  UdhaarEntryMode,
} from '@/hooks/ledger/udhaar/types';

import { UdhaarModeToggle } from './UdhaarModeToggle';
import { UdhaarItemRow } from './UdhaarItemRow';

export interface SelectedItemsProps {
  items: DraftUdhaarItem[];

  mode: UdhaarEntryMode;
  onChangeMode: (mode: UdhaarEntryMode) => void;

  onRemove: (id: string) => void;

  onChangeAmount: (
    id: string,
    amount: string
  ) => void;

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

  disabled?: boolean;
}

export const SelectedItems = memo(
  function SelectedItems({
    items,
    mode,
    onChangeMode,
    onRemove,
    onChangeAmount,
    onChangeQuantity,
    onChangeUnit,
    onChangeUnitPrice,
    disabled = false,
  }: SelectedItemsProps) {
    return (
      <View className="mt-4 gap-4">
        {/* Entry mode selector */}
        <View className="flex-row items-center justify-between gap-3">
          <AppText
            variant="small"
            className="text-muted"
          >
            Entry mode
          </AppText>

          <UdhaarModeToggle
            mode={mode}
            onChangeMode={onChangeMode}
            disabled={disabled}
            className="w-52"
          />
        </View>

        {/* Compact selected item rows */}
        {items.length > 0 ? (
          <View className="mt-2 gap-2.5">
            {items.map((item) => (
              <UdhaarItemRow
                key={item.id}
                item={item}
                mode={mode}
                onRemove={onRemove}
                onChangeAmount={onChangeAmount}
                onChangeQuantity={onChangeQuantity}
                onChangeUnit={onChangeUnit}
                onChangeUnitPrice={
                  onChangeUnitPrice
                }
                disabled={disabled}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }
);
