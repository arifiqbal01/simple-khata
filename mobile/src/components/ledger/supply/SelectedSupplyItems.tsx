
import { memo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { SelectedItemChip } from '@/components/ledger/shared/SelectedItemChip';

import type { DraftSupplyItem } from './types';

interface SelectedSupplyItemsProps {
  items: DraftSupplyItem[];
  onRemove: (id: string) => void;
}

export const SelectedSupplyItems = memo(
  function SelectedSupplyItems({
    items,
    onRemove,
  }: SelectedSupplyItemsProps) {
    const completedItems = items.filter(
      (item) => item.name.trim().length > 0
    );

    if (completedItems.length === 0) {
      return (
        <AppText className="mt-3 text-[13px] text-muted">
          Add an item to record this supply.
        </AppText>
      );
    }

    return (
      <View className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3">
        <View className="mb-3 flex-row items-center justify-between">
          <AppText className="font-spline-medium text-[13px] text-muted">
            Supplied items
          </AppText>

          <AppText className="font-spline-semibold text-[13px] text-foreground">
            {completedItems.length}
          </AppText>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {completedItems.map((item) => {
            const details = [
              item.quantity.trim(),
              item.unit.trim(),
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <View key={item.id} className="gap-1">
                <SelectedItemChip
                  name={item.name}
                  onRemove={() => onRemove(item.id)}
                />

                {details ? (
                  <AppText className="pl-2 text-[12px] text-muted">
                    {details}
                    {item.unitPrice.trim()
                      ? ` · Rs ${item.unitPrice.trim()} / unit`
                      : ''}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  }
);
