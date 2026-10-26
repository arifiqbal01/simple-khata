
import React, { useMemo, useState } from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText, Button } from '@/components/ui';
import { ItemUnitPicker } from '@/components/item';
import { ITEM_UNITS } from '@/config/item-units';

export interface SupplierCatalogItem {
  id: string;
  name: string;
  defaultUnit: string | null;
}

export interface SupplierProductFormValues {
  itemId: string;
  unit: string;
  unitPrice: string;
}

export interface SupplierProductFormProps {
  values: SupplierProductFormValues;
  items: SupplierCatalogItem[];
  onChange: (
    field: keyof SupplierProductFormValues,
    value: string
  ) => void;
  onSubmit: () => void;
  mode?: 'create' | 'edit';
  saving?: boolean;
  error?: string | null;
  onRemove?: () => void;
  removing?: boolean;
}

function getUnitLabel(value: string): string {
  return (
    ITEM_UNITS.find((unit) => unit.value === value)
      ?.label ?? value
  );
}

export function SupplierProductForm({
  values,
  items,
  onChange,
  onSubmit,
  mode = 'create',
  saving = false,
  error,
  onRemove,
  removing = false,
}: SupplierProductFormProps) {
  const [pickerVisible, setPickerVisible] =
    useState(false);

  const [search, setSearch] = useState('');

  const busy = saving || removing;

  const selectedItem = items.find(
    (item) => item.id === values.itemId
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
  }, [items, search]);

  const handleSelectItem = (
    item: SupplierCatalogItem
  ) => {
    onChange('itemId', item.id);

    // Suggest the catalog's default unit when
    // selecting a product. The supplier can
    // choose a different purchase unit.
    const validDefaultUnit = ITEM_UNITS.some(
      (unit) => unit.value === item.defaultUnit
    );

    onChange(
      'unit',
      validDefaultUnit
        ? item.defaultUnit ?? ''
        : ''
    );

    setPickerVisible(false);
    setSearch('');
  };

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
        {/* Catalog item */}
        <View>
          <AppText className="mb-2 font-spline-semibold text-[14px] text-foreground">
            Product *
          </AppText>

          <Pressable
            onPress={() => {
              setSearch('');
              setPickerVisible(true);
            }}
            disabled={busy || mode === 'edit'}
            accessibilityRole="button"
            accessibilityState={{
              disabled: busy || mode === 'edit',
            }}
            className="min-h-[52px] flex-row items-center justify-between rounded-[12px] border border-border bg-surface px-4"
          >
            <AppText
              numberOfLines={1}
              className={
                selectedItem
                  ? 'flex-1 text-[16px] text-foreground'
                  : 'flex-1 text-[16px] text-muted'
              }
            >
              {selectedItem?.name ??
                (values.itemId
                  ? 'Catalog product unavailable'
                  : 'Select product')}
            </AppText>

            {mode === 'create' ? (
              <Ionicons
                name="chevron-down"
                size={18}
                color="#9A9A93"
              />
            ) : null}
          </Pressable>
        </View>

        {/* Predefined purchase unit */}
        <ItemUnitPicker
          label="Purchase Unit"
          value={values.unit}
          onChange={(unit) =>
            onChange('unit', unit)
          }
          disabled={busy}
        />

        {/* Supplier purchase price */}
        <View>
          <AppText className="mb-2 font-spline-semibold text-[14px] text-foreground">
            Purchase Price (Rs) *
          </AppText>

          <TextInput
            value={values.unitPrice}
            onChangeText={(value) =>
              onChange('unitPrice', value)
            }
            placeholder="e.g. 180"
            placeholderTextColor="#9A9A93"
            keyboardType="number-pad"
            editable={!busy}
            className="min-h-[52px] rounded-[12px] border border-border bg-surface px-4 text-[16px] text-foreground"
          />

          <AppText className="mt-2 text-[12px] text-muted">
            This price applies only to this supplier.
            It does not change the item's selling price.
          </AppText>
        </View>

        {/* Error */}
        {error ? (
          <AppText className="text-[13px] text-red-600">
            {error}
          </AppText>
        ) : null}

        {/* Save */}
        <Button
          label={
            saving
              ? 'Saving...'
              : mode === 'create'
                ? 'Add Product'
                : 'Save Changes'
          }
          onPress={onSubmit}
          disabled={
            busy ||
            !values.itemId ||
            !values.unit ||
            !values.unitPrice.trim()
          }
        />

        {/* Remove supplier association */}
        {mode === 'edit' && onRemove ? (
          <Button
            label={
              removing
                ? 'Removing...'
                : 'Remove Product'
            }
            variant="secondary"
            onPress={onRemove}
            disabled={busy}
          />
        ) : null}
      </View>

      {/* Catalog item picker */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPickerVisible(false)
        }
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="flex-1"
            onPress={() =>
              setPickerVisible(false)
            }
            accessibilityLabel="Close product picker"
          />

          <View className="max-h-[80%] rounded-t-[24px] bg-background px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="font-spline-bold text-[19px] text-foreground">
                Select Product
              </AppText>

              <Pressable
                onPress={() =>
                  setPickerVisible(false)
                }
                accessibilityRole="button"
                accessibilityLabel="Close product picker"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#242422"
                />
              </Pressable>
            </View>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search products..."
              placeholderTextColor="#9A9A93"
              autoCapitalize="none"
              className="mb-3 min-h-[48px] rounded-[12px] border border-border bg-surface px-4 text-[15px] text-foreground"
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    handleSelectItem(item)
                  }
                  accessibilityRole="button"
                  className="min-h-[52px] flex-row items-center justify-between border-b border-border py-3"
                >
                  <View className="min-w-0 flex-1">
                    <AppText
                      numberOfLines={1}
                      className="text-[15px] text-foreground"
                    >
                      {item.name}
                    </AppText>

                    {item.defaultUnit ? (
                      <AppText className="mt-1 text-[12px] text-muted">
                        {getUnitLabel(item.defaultUnit)}
                      </AppText>
                    ) : null}
                  </View>

                  {values.itemId === item.id ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color="#242422"
                    />
                  ) : null}
                </Pressable>
              ))}

              {filteredItems.length === 0 ? (
                <AppText className="py-8 text-center text-[13px] text-muted">
                  No matching products found.
                </AppText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}