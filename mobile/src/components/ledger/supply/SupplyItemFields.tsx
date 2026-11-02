
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

export interface SupplyItemFieldsProps {
  onAdd: () => void;
  disabled?: boolean;
  loading?: boolean;
  availableCount?: number;
}

export const SupplyItemFields = memo(
  function SupplyItemFields({
    onAdd,
    disabled = false,
    loading = false,
    availableCount,
  }: SupplyItemFieldsProps) {
    const cannotAdd =
      disabled ||
      loading ||
      availableCount === 0;

    return (
      <View className="mt-4">
        <Pressable
          onPress={onAdd}
          disabled={cannotAdd}
          accessibilityRole="button"
          accessibilityLabel="Select a supplier product"
          accessibilityState={{
            disabled: cannotAdd,
          }}
          className={`flex-row items-center justify-center rounded-xl border border-border bg-surface px-4 py-3 ${
            cannotAdd
              ? 'opacity-50'
              : 'active:opacity-80'
          }`}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color="#242422"
          />

          <AppText
            variant="bodyMedium"
            className="ml-2 text-foreground"
          >
            {loading
              ? 'Loading supplier products...'
              : 'Add supply item'}
          </AppText>
        </Pressable>

        {!loading && availableCount === 0 ? (
          <AppText
            variant="caption"
            className="mt-2 text-center text-muted"
          >
            No products are configured for this supplier.
          </AppText>
        ) : null}
      </View>
    );
  }
);
