
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  AppText,
  IconButton,
  SearchField,
} from '@/components/ui';

import { ITEM_UNITS } from '@/config/item-units';

import type {
  AvailableSupplyItem,
} from '@/hooks/ledger/supply/types';

export interface SupplyItemSearchSheetProps {
  visible: boolean;

  /**
   * Must come from useSupplyCatalog
   * for the currently verified supplier.
   */
  availableItems: AvailableSupplyItem[];

  /**
   * Global item IDs already selected
   * in the current supply draft.
   */
  selectedItemIds: string[];

  onClose: () => void;

  onSelectItem: (
    item: AvailableSupplyItem
  ) => void;

  disabled?: boolean;
}

function getUnitLabel(value: string): string {
  return (
    ITEM_UNITS.find((unit) => unit.value === value)
      ?.label ?? value
  );
}

function formatMoney(value: number): string {
  return `Rs ${value.toLocaleString('en-PK')}`;
}

export const SupplyItemSearchSheet = memo(
  function SupplyItemSearchSheet({
    visible,
    availableItems,
    selectedItemIds,
    onClose,
    onSelectItem,
    disabled = false,
  }: SupplyItemSearchSheetProps) {
    const [query, setQuery] = useState('');

    useEffect(() => {
      if (visible) {
        setQuery('');
      }
    }, [visible]);

    const selectedSet = useMemo(
      () => new Set(selectedItemIds),
      [selectedItemIds]
    );

    const filteredProducts = useMemo(() => {
      const normalizedQuery =
        query.trim().toLocaleLowerCase();

      const seen = new Set<string>();

      const products = availableItems.filter(
        (product) => {
          if (
            !product.id ||
            !product.item_id ||
            selectedSet.has(product.item_id) ||
            seen.has(product.item_id)
          ) {
            return false;
          }

          seen.add(product.item_id);

          return (
            !normalizedQuery ||
            product.item_name
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          );
        }
      );

      if (!normalizedQuery) {
        return products;
      }

      return products.sort((a, b) => {
        const aName =
          a.item_name.toLocaleLowerCase();

        const bName =
          b.item_name.toLocaleLowerCase();

        const rank = (name: string) =>
          name === normalizedQuery
            ? 0
            : name.startsWith(normalizedQuery)
              ? 1
              : 2;

        return (
          rank(aName) - rank(bName) ||
          aName.localeCompare(bName)
        );
      });
    }, [availableItems, selectedSet, query]);

    const closeSheet = useCallback(() => {
      Keyboard.dismiss();
      onClose();
    }, [onClose]);

    const handleSelect = useCallback(
      (item: AvailableSupplyItem) => {
        if (disabled) return;

        /*
         * Resolve against the current
         * supplier-associated catalog.
         *
         * Never trust a product object
         * from another source.
         */
        const configuredProduct =
          availableItems.find(
            (product) =>
              product.id === item.id &&
              product.item_id === item.item_id
          );

        if (
          !configuredProduct ||
          selectedSet.has(
            configuredProduct.item_id
          )
        ) {
          return;
        }

        Keyboard.dismiss();
        onSelectItem(configuredProduct);
        onClose();
      },
      [
        disabled,
        availableItems,
        selectedSet,
        onSelectItem,
        onClose,
      ]
    );

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/40"
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close supplier product search"
          />

          <View className="max-h-[85%] rounded-t-3xl bg-background px-5 pb-8 pt-3">
            <View className="items-center pb-4">
              <View className="h-1.5 w-12 rounded-full bg-border-strong" />
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <AppText variant="heading">
                  Add supply item
                </AppText>

                <AppText
                  variant="caption"
                  className="mt-1 text-muted"
                >
                  Products configured for this supplier
                </AppText>
              </View>

              <IconButton
                onPress={closeSheet}
                accessibilityLabel="Close supplier product search"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#777770"
                />
              </IconButton>
            </View>

            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search supplier products"
              accessibilityLabel="Search supplier products"
              autoCapitalize="words"
            />

            <ScrollView
              className="mt-4"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredProducts.map(
                (product, index) => (
                  <Pressable
                    key={product.id}
                    onPress={() =>
                      handleSelect(product)
                    }
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${product.item_name}`}
                    className={`flex-row items-center justify-between py-4 ${
                      index <
                      filteredProducts.length - 1
                        ? 'border-b border-border'
                        : ''
                    }`}
                  >
                    <View className="min-w-0 flex-1">
                      <AppText
                        variant="bodyMedium"
                        numberOfLines={1}
                      >
                        {product.item_name}
                      </AppText>

                      <AppText
                        variant="caption"
                        className="mt-1 text-muted"
                      >
                        {getUnitLabel(product.unit)}
                        {' · '}
                        {formatMoney(
                          product.unit_price
                        )}
                      </AppText>
                    </View>

                    <Ionicons
                      name="add-circle-outline"
                      size={22}
                      color="#777770"
                    />
                  </Pressable>
                )
              )}

              {filteredProducts.length === 0 ? (
                <AppText
                  variant="small"
                  className="py-8 text-center text-muted"
                >
                  {availableItems.length === 0
                    ? 'No products configured for this supplier.'
                    : query.trim()
                      ? 'No matching supplier products.'
                      : 'All supplier products are already selected.'}
                </AppText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
);
