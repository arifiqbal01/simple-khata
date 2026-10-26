
import React from 'react';

import {
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import {
  AppText,
  Button,
} from '@/components/ui';

import { ItemUnitPicker } from './ItemUnitPicker';

export interface ItemFormValues {
  name: string;
  defaultUnit: string;
  defaultSellingPrice: string;
}

export interface ItemFormProps {
  values: ItemFormValues;
  onChange: (
    field: keyof ItemFormValues,
    value: string
  ) => void;
  onSubmit: () => void;
  saving?: boolean;
  mode?: 'create' | 'edit';
  error?: string | null;
  onDelete?: () => void;
  deleting?: boolean;
}

export function ItemForm({
  values,
  onChange,
  onSubmit,
  saving = false,
  mode = 'create',
  error,
  onDelete,
  deleting = false,
}: ItemFormProps) {
  const busy = saving || deleting;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-5">
        {/* Item name */}
        <View>
          <AppText className="mb-2 font-spline-semibold text-[14px] text-foreground">
            Item Name *
          </AppText>

          <TextInput
            value={values.name}
            onChangeText={(value) =>
              onChange('name', value)
            }
            placeholder="e.g. Sugar"
            placeholderTextColor="#9A9A93"
            maxLength={150}
            editable={!busy}
            autoCapitalize="words"
            className="
              min-h-[52px]
              rounded-[12px]
              border
              border-border
              bg-surface
              px-4
              text-[16px]
              text-foreground
            "
          />
        </View>

        {/* Predefined item unit */}
        <ItemUnitPicker
          label="Unit"
          value={values.defaultUnit}
          onChange={(unit) =>
            onChange('defaultUnit', unit)
          }
          disabled={busy}
          optional
        />

        {/* Default selling price */}
        <View>
          <AppText className="mb-2 font-spline-semibold text-[14px] text-foreground">
            Default Selling Price (Rs)
          </AppText>

          <TextInput
            value={values.defaultSellingPrice}
            onChangeText={(value) =>
              onChange(
                'defaultSellingPrice',
                value
              )
            }
            placeholder="e.g. 180"
            placeholderTextColor="#9A9A93"
            keyboardType="number-pad"
            editable={!busy}
            className="
              min-h-[52px]
              rounded-[12px]
              border
              border-border
              bg-surface
              px-4
              text-[16px]
              text-foreground
            "
          />

          <AppText className="mt-2 text-[12px] text-muted">
            Optional. This is your selling price,
            not a supplier purchase price.
          </AppText>
        </View>

        {/* Error message */}
        {error ? (
          <AppText className="text-[13px] text-red-600">
            {error}
          </AppText>
        ) : null}

        {/* Submit button */}
        <Button
          label={
            saving
              ? 'Saving...'
              : mode === 'create'
                ? 'Add Item'
                : 'Save Changes'
          }
          onPress={onSubmit}
          disabled={busy}
          className="mt-2"
        />

        {/* Delete button */}
        {mode === 'edit' && onDelete ? (
          <Button
            label={
              deleting
                ? 'Deleting...'
                : 'Delete Item'
            }
            variant="secondary"
            onPress={onDelete}
            disabled={busy}
            className="mt-2"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}