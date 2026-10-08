
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { AppText, Chip } from '@/components/ui';

import {
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

import type {
  QuickItem,
} from '@/services/item/get-quick-items';

interface QuickItemsProps {
  items: QuickItem[];
  selectedNames: string[];
  onToggle: (item: QuickItem) => void;
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export const QuickItems = memo(function QuickItems({
  items,
  selectedNames,
  onToggle,
}: QuickItemsProps) {
  const selectedSet = useMemo(
    () => new Set(selectedNames.map(normalize)),
    [selectedNames]
  );

  const visibleItems = useMemo(
    () => items.slice(0, QUICK_ITEMS_VISIBLE_LIMIT),
    [items]
  );

  if (visibleItems.length === 0) return null;

  return (
    <View className="mt-5">
      <AppText className="mb-3 font-spline-medium text-[13px] text-muted">
        Quick items
      </AppText>

      <View className="flex-row flex-wrap gap-2">
        {visibleItems.map((item) => (
          <Chip
            key={item.id ?? normalize(item.name)}
            label={item.name}
            selected={selectedSet.has(
              normalize(item.name)
            )}
            onPress={() => onToggle(item)}
          />
        ))}
      </View>
    </View>
  );
});
