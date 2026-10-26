
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import Toast from 'react-native-toast-message';

import {
  AppText,
  SaveButton,
  Screen,
} from '@/components/ui';

import {
  useAddSupply,
  type AvailableSupplyItem,
} from '@/hooks/ledger/useAddSupply';

import { ITEM_UNITS } from '@/config/item-units';

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString('en-PK', {
        maximumFractionDigits: 2,
      })
    : '0';
}

function getUnitLabel(value: string): string {
  return (
    ITEM_UNITS.find((unit) => unit.value === value)
      ?.label ?? value
  );
}

export default function AddSupplyScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    ledgerFrom?: string | string[];
  }>();

  const supplierId = firstParam(params.id);
  const from = firstParam(params.from);
  const ledgerFrom = firstParam(params.ledgerFrom);

  const {
    supplier,
    balance,
    items,
    availableItems,
    totalAmount,
    projectedBalance,
    loading,
    saving,
    error,
    validAmount,
    addItemRow,
    removeItem,
    updateItem,
    selectItem,
    save,
  } = useAddSupply(supplierId);

  const scrollRef = useRef<ScrollView>(null);
  const savingRef = useRef(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [pickerRowId, setPickerRowId] =
    useState<string | null>(null);

  const [search, setSearch] = useState('');

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return availableItems;
    }

    return availableItems.filter((product) =>
      product.item_name.toLowerCase().includes(query)
    );
  }, [availableItems, search]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();

    if (supplierId) {
      router.replace({
        pathname: '/suppliers/[id]',
        params: {
          id: supplierId,
          from:
            from === 'ledger'
              ? ledgerFrom ?? 'suppliers'
              : from ?? 'suppliers',
        },
      });

      return;
    }

    router.replace('/suppliers');
  }, [supplierId, from, ledgerFrom]);

  const handleSave = useCallback(async () => {
    if (
      !validAmount ||
      saving ||
      savingRef.current
    ) {
      return;
    }

    savingRef.current = true;
    setSaveError(null);
    Keyboard.dismiss();

    try {
      const saved = await save();

      if (saved) {
        handleClose();
      }
    } catch (cause) {
      console.error(
        '[add-supply] Save failed:',
        cause
      );

      const message =
        cause instanceof Error
          ? cause.message
          : 'Could not record supply.';

      setSaveError(message);

      Toast.show({
        type: 'error',
        text1: 'Could not record supply',
        text2: message,
      });
    } finally {
      savingRef.current = false;
    }
  }, [validAmount, saving, save, handleClose]);

  const handleAddItem = useCallback(() => {
    addItemRow();

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    });
  }, [addItemRow]);

  const openPicker = useCallback((rowId: string) => {
    Keyboard.dismiss();
    setSearch('');
    setPickerRowId(rowId);
  }, []);

  const closePicker = useCallback(() => {
    setPickerRowId(null);
    setSearch('');
  }, []);

  const handleSelectProduct = useCallback(
    (product: AvailableSupplyItem) => {
      if (!pickerRowId || saving) {
        return;
      }

      selectItem(pickerRowId, product);
      closePicker();
    },
    [pickerRowId, saving, selectItem, closePicker]
  );

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color="#242422"
          />
        </View>
      </Screen>
    );
  }

  if (!supplier) {
    return (
      <Screen>
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#242422"
            />
          </Pressable>

          <AppText className="ml-2 font-spline-semibold text-[18px] text-foreground">
            Add Supply
          </AppText>
        </View>

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {error ?? 'Supplier could not be loaded.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Fixed header */}
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleClose}
            disabled={saving}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-9 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#181816"
            />
          </Pressable>

          <AppText className="font-spline-semibold text-[19px] text-foreground">
            Add Supply
          </AppText>
        </View>

        <SaveButton
          loading={saving}
          disabled={!validAmount || saving}
          accessibilityLabel="Save Supply"
          onPress={() => {
            void handleSave();
          }}
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Supplier information */}
          <View className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-5">
            <View className="min-w-0 flex-1">
              <AppText
                numberOfLines={2}
                className="font-spline-bold text-[23px] leading-[29px] text-foreground"
              >
                {supplier.name}
              </AppText>

              <AppText className="mt-1 text-[12px] text-muted">
                Supplier
              </AppText>
            </View>

            <View className="items-end">
              <AppText className="font-spline-semibold text-[20px] text-foreground">
                Rs {formatMoney(balance)}
              </AppText>

              <AppText className="mt-1 text-[12px] text-muted">
                Current payable
              </AppText>
            </View>
          </View>

          <View className="px-5">
            {/* Items heading */}
            <View className="mb-4 mt-7 flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <AppText className="font-spline-semibold text-[18px] text-foreground">
                  Supply items
                </AppText>

                <AppText className="mt-1 text-[12px] text-muted">
                  Select supplier products and enter quantity
                </AppText>
              </View>

              <Pressable
                onPress={handleAddItem}
                disabled={
                  saving ||
                  availableItems.length === 0
                }
                accessibilityRole="button"
                accessibilityLabel="Add another item"
                className="flex-row items-center rounded-full bg-chip px-3 py-2"
              >
                <Ionicons
                  name="add"
                  size={18}
                  color="#242422"
                />

                <AppText className="ml-1 font-spline-medium text-[13px] text-foreground">
                  Add item
                </AppText>
              </Pressable>
            </View>

            {availableItems.length === 0 ? (
              <View className="mb-4 rounded-xl border border-border bg-chip px-4 py-4">
                <AppText className="font-spline-semibold text-[14px] text-foreground">
                  No supplier products
                </AppText>

                <AppText className="mt-2 text-[13px] text-muted">
                  Add products to this supplier before recording a supply.
                </AppText>
              </View>
            ) : null}

            {/* Supply rows */}
            {availableItems.length > 0 &&
              items.map((item, index) => {
                const quantity = Number(item.quantity);
                const price = Number(item.unitPrice);

                const lineAmount =
                  item.quantity.trim() &&
                  item.unitPrice.trim() &&
                  Number.isFinite(quantity) &&
                  Number.isFinite(price)
                    ? quantity * price
                    : 0;

                return (
                  <View
                    key={item.id}
                    className="mb-4 rounded-2xl border border-border bg-background p-4"
                  >
                    <View className="mb-4 flex-row items-center justify-between">
                      <AppText className="font-spline-semibold text-[14px] text-foreground">
                        Item {index + 1}
                      </AppText>

                      {items.length > 1 ? (
                        <Pressable
                          onPress={() =>
                            removeItem(item.id)
                          }
                          disabled={saving}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove item ${index + 1}`}
                          hitSlop={8}
                          className="h-8 w-8 items-center justify-center"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#B44A43"
                          />
                        </Pressable>
                      ) : null}
                    </View>

                    {/* Supplier product picker */}
                    <AppText className="mb-2 text-[12px] text-muted">
                      Supplier product
                    </AppText>

                    <Pressable
                      onPress={() =>
                        openPicker(item.id)
                      }
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="Select supplier product"
                      className="min-h-12 flex-row items-center justify-between rounded-control border border-border px-3"
                    >
                      <AppText
                        numberOfLines={1}
                        className={
                          item.itemId
                            ? 'min-w-0 flex-1 text-[16px] text-foreground'
                            : 'min-w-0 flex-1 text-[16px] text-muted'
                        }
                      >
                        {item.itemId
                          ? item.name
                          : 'Select product'}
                      </AppText>

                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color="#9B9B96"
                      />
                    </Pressable>

                    {/* Quantity and purchase unit */}
                    <View className="mt-4 flex-row gap-3">
                      <View className="flex-[2]">
                        <AppText className="mb-2 text-[12px] text-muted">
                          Quantity
                        </AppText>

                        <TextInput
                          value={item.quantity}
                          onChangeText={(value) =>
                            updateItem(item.id, {
                              quantity: value,
                            })
                          }
                          keyboardType="decimal-pad"
                          placeholder="1"
                          placeholderTextColor="#9B9B96"
                          editable={
                            !saving && !!item.itemId
                          }
                          className="min-h-12 rounded-control border border-border px-3 font-sans text-[16px] text-foreground"
                        />
                      </View>

                      <View className="flex-1">
                        <AppText className="mb-2 text-[12px] text-muted">
                          Unit
                        </AppText>

                        <View className="min-h-12 justify-center rounded-control border border-border bg-chip px-3">
                          <AppText
                            numberOfLines={1}
                            className="text-[14px] text-foreground"
                          >
                            {item.unit
                              ? getUnitLabel(item.unit)
                              : '—'}
                          </AppText>
                        </View>
                      </View>
                    </View>

                    {/* Supplier purchase price */}
                    <View className="mt-4">
                      <AppText className="mb-2 text-[12px] text-muted">
                        Purchase price per unit (Rs)
                      </AppText>

                      <View className="min-h-12 justify-center rounded-control border border-border bg-chip px-3">
                        <AppText className="text-[16px] text-foreground">
                          {item.itemId
                            ? formatMoney(
                                Number(item.unitPrice)
                              )
                            : 'Select a product'}
                        </AppText>
                      </View>
                    </View>

                    {/* Calculated line total */}
                    <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3">
                      <AppText className="text-[13px] text-muted">
                        Item total
                      </AppText>

                      <AppText className="font-spline-semibold text-[16px] text-foreground">
                        Rs {formatMoney(lineAmount)}
                      </AppText>
                    </View>
                  </View>
                );
              })}

            {/* Supply totals */}
            <View className="mt-4 rounded-2xl bg-chip px-4 py-5">
              <View className="flex-row items-center justify-between">
                <AppText className="font-spline-medium text-[15px] text-foreground">
                  Supply total
                </AppText>

                <AppText className="font-spline-bold text-[23px] text-foreground">
                  Rs {formatMoney(totalAmount)}
                </AppText>
              </View>

              <View className="my-4 h-px bg-border" />

              <View className="flex-row items-center justify-between">
                <AppText className="text-[13px] text-muted">
                  Payable after supply
                </AppText>

                <AppText className="font-spline-semibold text-[17px] text-udhaar">
                  Rs {formatMoney(projectedBalance)}
                </AppText>
              </View>
            </View>

            {saveError ? (
              <View className="mt-5 rounded-xl border border-udhaar/20 bg-udhaar/5 px-4 py-3">
                <AppText className="text-[14px] text-udhaar">
                  {saveError}
                </AppText>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Supplier-specific product picker */}
      <Modal
        visible={pickerRowId !== null}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="flex-1"
            onPress={closePicker}
            accessibilityRole="button"
            accessibilityLabel="Close product picker"
          />

          <View className="max-h-[80%] rounded-t-[24px] bg-background px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="font-spline-bold text-[19px] text-foreground">
                Select Supplier Product
              </AppText>

              <Pressable
                onPress={closePicker}
                accessibilityRole="button"
                accessibilityLabel="Close product picker"
                hitSlop={10}
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
              placeholder="Search supplier products..."
              placeholderTextColor="#9B9B96"
              autoCapitalize="none"
              className="mb-3 min-h-12 rounded-control border border-border px-3 text-[16px] text-foreground"
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredProducts.map((product) => {
                const currentRow = items.find(
                  (row) => row.id === pickerRowId
                );

                const selected =
                  currentRow?.itemId ===
                  product.item_id;

                return (
                  <Pressable
                    key={product.id}
                    onPress={() =>
                      handleSelectProduct(product)
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                    }}
                    className="min-h-[64px] flex-row items-center justify-between border-b border-border py-3"
                  >
                    <View className="min-w-0 flex-1">
                      <AppText
                        numberOfLines={1}
                        className="font-spline-medium text-[15px] text-foreground"
                      >
                        {product.item_name}
                      </AppText>

                      <AppText className="mt-1 text-[12px] text-muted">
                        {getUnitLabel(product.unit)}
                        {' · '}
                        Rs {formatMoney(
                          product.unit_price
                        )}
                      </AppText>
                    </View>

                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color="#242422"
                      />
                    ) : null}
                  </Pressable>
                );
              })}

              {filteredProducts.length === 0 ? (
                <AppText className="py-8 text-center text-[13px] text-muted">
                  No matching supplier products found.
                </AppText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
