
import { memo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';

import { UdhaarModeToggle } from
  '@/components/ledger/udhaar/UdhaarModeToggle';

import { SupplyItemRow } from './SupplyItemRow';

import type {
  DraftSupplyItem,
  SupplyEntryMode,
} from '@/hooks/ledger/supply/types';

export interface SelectedSupplyItemsProps {
  items: DraftSupplyItem[];

  mode: SupplyEntryMode;
  onChangeMode: (mode: SupplyEntryMode) => void;

  onRemove: (id: string) => void;

  onChangeAmount: (
    id: string,
    amount: string
  ) => void;

  onChangeQuantity: (
    id: string,
    quantity: string
  ) => void;

  disabled?: boolean;
}

export const SelectedSupplyItems = memo(
  function SelectedSupplyItems({
    items,
    mode,
    onChangeMode,
    onRemove,
    onChangeAmount,
    onChangeQuantity,
    disabled = false,
  }: SelectedSupplyItemsProps) {
    /*
     * Only show products that have been
     * selected from the supplier catalog.
     *
     * Empty draft rows stay hidden.
     */
    const selectedItems = items.filter(
      (item) =>
        item.itemId !== null &&
        item.name.trim().length > 0
    );

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

        {/* Selected supplier product rows */}
        {selectedItems.length > 0 ? (
          <View className="mt-2 gap-2.5">
            {selectedItems.map((item) => (
              <SupplyItemRow
                key={item.id}
                item={item}
                mode={mode}
                onRemove={onRemove}
                onChangeAmount={onChangeAmount}
                onChangeQuantity={onChangeQuantity}
                disabled={disabled}
              />
            ))}
          </View>
        ) : (
          <AppText
            variant="small"
            className="mt-2 text-muted"
          >
            Add a product configured for this supplier
            to record a supply.
          </AppText>
        )}
      </View>
    );
  }
);
