
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { AppText, Chip } from '@/components/ui';

import type {
  QuickItem,
} from '@/services/item/get-quick-items';

interface QuickItemsProps {
  items: QuickItem[];
  selectedNames: string[];
  onToggle: (item: QuickItem) => void;
}

const QUICK_ITEMS_LIMIT = 5;

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

  /*
   * The service must supply actual usage-ranked
   * catalog items, not predefined starter items.
   *
   * Hide already-selected items and avoid
   * duplicate names.
   */
  const visibleItems = useMemo(() => {
    const seen = new Set<string>();
    const result: QuickItem[] = [];

    for (const item of items) {
      const normalized = normalize(item.name);

      if (
        !normalized ||
        selectedSet.has(normalized) ||
        seen.has(normalized)
      ) {
        continue;
      }

      // A real catalog item must have an ID.
      if (!item.id) {
        continue;
      }

      seen.add(normalized);
      result.push(item);

      if (result.length >= QUICK_ITEMS_LIMIT) {
        break;
      }
    }

    return result;
  }, [items, selectedSet]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <View className="mt-4">
      <AppText className="mb-3 font-spline-medium text-[13px] text-muted">
        Most used items
      </AppText>

      <View className="flex-row flex-wrap gap-2">
        {visibleItems.map((item) => (
          <Chip
            key={item.id!}
            label={item.name}
            selected={false}
            onPress={() => onToggle(item)}
          />
        ))}
      </View>
    </View>
  );
});
