
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, TextField } from '@/components/ui';

import type { DraftSupplyItem } from './types';

interface SupplyItemFieldsProps {
  items: DraftSupplyItem[];

  onChange: (
    id: string,
    patch: Partial<
      Pick<
        DraftSupplyItem,
        'name' | 'quantity' | 'unit' | 'unitPrice'
      >
    >
  ) => void;

  onRemove: (id: string) => void;
  onAdd: () => void;
}

export const SupplyItemFields = memo(
  function SupplyItemFields({
    items,
    onChange,
    onRemove,
    onAdd,
  }: SupplyItemFieldsProps) {
    return (
      <View className="mt-5">
        <AppText className="mb-3 font-spline-medium text-[13px] text-muted">
          Supplied items
        </AppText>

        <View className="gap-3">
          {items.map((item) => (
            <View
              key={item.id}
              className="rounded-2xl border border-border bg-surface p-3"
            >
              <View className="flex-row items-center gap-2">
                <TextField
                  value={item.name}
                  onChangeText={(name) =>
                    onChange(item.id, { name })
                  }
                  placeholder="Item name"
                  autoCapitalize="words"
                  className="flex-1"
                />

                <Pressable
                  onPress={() => onRemove(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name || 'item'}`}
                  hitSlop={8}
                  className="h-12 w-9 items-center justify-center"
                >
                  <Ionicons
                    name="close"
                    size={21}
                    color="#D9544D"
                  />
                </Pressable>
              </View>

              <View className="mt-3 flex-row gap-2">
                <View className="flex-1">
                  <TextField
                    value={item.quantity}
                    onChangeText={(quantity) =>
                      onChange(item.id, { quantity })
                    }
                    placeholder="Qty"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View className="flex-1">
                  <TextField
                    value={item.unit}
                    onChangeText={(unit) =>
                      onChange(item.id, { unit })
                    }
                    placeholder="Unit"
                  />
                </View>

                <View className="flex-1">
                  <TextField
                    value={item.unitPrice}
                    onChangeText={(unitPrice) =>
                      onChange(item.id, { unitPrice })
                    }
                    placeholder="Price"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add another supplied item"
          className="mt-4 flex-row items-center self-start rounded-xl border border-border bg-surface px-4 py-3"
        >
          <Ionicons
            name="add"
            size={19}
            color="#242422"
          />

          <AppText className="ml-2 font-spline-medium text-[14px] text-foreground">
            Add another item
          </AppText>
        </Pressable>
      </View>
    );
  }
);
