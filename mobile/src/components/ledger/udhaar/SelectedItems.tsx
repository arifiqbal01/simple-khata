
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import type {
  DraftUdhaarItem,
} from '@/hooks/ledger/useAddUdhaar';

interface SelectedItemsProps {
  items: DraftUdhaarItem[];
  onRemove: (id: string) => void;
}

export const SelectedItems = memo(function SelectedItems({
  items,
  onRemove,
}: SelectedItemsProps) {
  if (items.length === 0) {
    return (
      <AppText className="mt-3 text-[13px] text-muted">
        Tap a quick item or search to add one.
      </AppText>
    );
  }

  return (
    <View className="mt-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <View className="mb-3 flex-row items-center justify-between">
        <AppText className="font-spline-medium text-[13px] text-muted">
          Added items
        </AppText>

        <AppText className="font-spline-semibold text-[13px] text-foreground">
          {items.length}
        </AppText>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onRemove(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}
            className="flex-row items-center gap-2 rounded-xl border border-[#D7E8DB] bg-[#F0F7F1] px-3 py-2"
          >
            <Ionicons
              name="checkmark-circle"
              size={17}
              color="#15803D"
            />

            <AppText
              numberOfLines={1}
              className="max-w-[180px] font-spline-medium text-[14px] text-[#245D38]"
            >
              {item.name.trim()}
            </AppText>

            <Ionicons
              name="close"
              size={16}
              color="#64786B"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
});
