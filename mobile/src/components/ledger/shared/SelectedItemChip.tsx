
import { memo } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

interface SelectedItemChipProps {
  name: string;
  onRemove: () => void;
}

export const SelectedItemChip = memo(
  function SelectedItemChip({
    name,
    onRemove,
  }: SelectedItemChipProps) {
    return (
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
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
          {name.trim()}
        </AppText>

        <Ionicons
          name="close"
          size={16}
          color="#64786B"
        />
      </Pressable>
    );
  }
);
