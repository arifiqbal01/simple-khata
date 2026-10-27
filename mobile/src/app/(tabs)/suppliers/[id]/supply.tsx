import React, {
  useCallback,
  useEffect,
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
import { UdhaarModeToggle } from '@/components/ledger/udhaar/UdhaarModeToggle';
import type { UdhaarEntryMode } from '@/hooks/ledger/udhaar/types';

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
  const pendingSelection = useRef<{ product: AvailableSupplyItem; existingIds: Set<string> } | null>(null);

  const [search, setSearch] = useState('');
  const [entryMode, setEntryMode] = useState<UdhaarEntryMode>('quantity');
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  // The hook may maintain an initial blank draft. Never render it as a selected product.
  const selectedItems = useMemo(
    () => items.filter((item) => !!item.itemId && !!item.name.trim()),
    [items]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const options = availableItems.filter((product) => {
      const alreadySelected = items.some((row) =>
        row.itemId === product.item_id && row.id !== pickerRowId
      );
      return !alreadySelected;
    });

    if (!query) return options;

    return options.filter((product) =>
      product.item_name.toLocaleLowerCase().includes(query)
    ).sort((a, b) => {
      const aName = a.item_name.toLocaleLowerCase();
      const bName = b.item_name.toLocaleLowerCase();
      const rank = (name: string) => name === query ? 0 : name.startsWith(query) ? 1 : 2;
      return rank(aName) - rank(bName) || aName.localeCompare(bName);
    });
  }, [availableItems, search, items, pickerRowId]);

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
      selectedItems.length === 0 ||
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
  }, [validAmount, selectedItems.length, saving, save, handleClose]);

  // Opening Add Item must not create an empty row. Create it only
  // after the user chooses a product from this supplier's list.
  const handleAddItem = useCallback(() => {
    Keyboard.dismiss();
    setSearch('');
    setPickerRowId('__new__');
  }, []);

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
      if (!pickerRowId || saving) return;

      if (pickerRowId === '__new__') {
        // Reuse an existing blank row (some supply hooks start with one).
        const blankRow = items.find((row) => !row.itemId);
        if (blankRow) {
          selectItem(blankRow.id, product);
        } else {
          pendingSelection.current = {
            product,
            existingIds: new Set(items.map((row) => row.id)),
          };
          addItemRow();
        }
      } else {
        selectItem(pickerRowId, product);
      }

      closePicker();
    },
    [pickerRowId, saving, items, selectItem, addItemRow, closePicker]
  );

  // addItemRow() may return void. Select using the newly created ID
  // after React commits the row, rather than assuming a return value.
  useEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;

    const newRow = items.find((row) => !pending.existingIds.has(row.id));
    if (!newRow) return;

    pendingSelection.current = null;
    selectItem(newRow.id, pending.product);
  }, [items, selectItem]);

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
          disabled={!validAmount || selectedItems.length === 0 || saving}
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
            {/* Compact item actions */}
            <Pressable
              onPress={handleAddItem}
              disabled={saving || availableItems.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Add supply item"
              className="mt-5 flex-row items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-4 active:opacity-70"
            >
              <Ionicons name="add-circle-outline" size={22} color="#181816" />
              <AppText variant="bodyMedium">Add Item</AppText>
            </Pressable>

            <View className="mb-5 mt-4 flex-row items-center justify-between gap-3">
              <AppText variant="small">Entry mode</AppText>
              <UdhaarModeToggle
                mode={entryMode}
                onChangeMode={(nextMode) => {
                  if (nextMode === 'amount') {
                    const drafts: Record<string, string> = {};
                    for (const item of items) {
                      const quantity = Number(item.quantity);
                      const price = Number(item.unitPrice);
                      if (item.quantity.trim() && item.unitPrice.trim() && Number.isFinite(quantity) && Number.isFinite(price)) {
                        drafts[item.id] = String(Math.round(quantity * price));
                      }
                    }
                    setAmountDrafts(drafts);
                  }
                  setEntryMode(nextMode);
                }}
                disabled={saving}
                className="w-52"
              />
            </View>

            {availableItems.length === 0 ? (
              <View className="mb-4 rounded-xl border border-border bg-chip px-4 py-4">
                <AppText variant="bodyMedium">No supplier products</AppText>
                <AppText variant="small" className="mt-2">
                  Add products to this supplier before recording a supply.
                </AppText>
              </View>
            ) : null}

            <View className="gap-3">
              {selectedItems.map((item) => {
                const quantity = Number(item.quantity);
                const price = Number(item.unitPrice);
                const lineAmount = item.quantity.trim() && item.unitPrice.trim() && Number.isFinite(quantity) && Number.isFinite(price)
                  ? Math.round(quantity * price) : 0;
                const unit = item.unit ? getUnitLabel(item.unit) : 'No unit';
                const amountValue = amountDrafts[item.id] ?? (item.quantity.trim() ? String(lineAmount) : '');
                return (
                  <View key={item.id} className="min-h-[76px] flex-row items-center gap-2 rounded-control border border-border bg-background px-3 py-3">
                    <View className="min-w-0 flex-1 justify-center">
                      <AppText variant="bodyMedium" numberOfLines={1}>
                        {item.itemId ? item.name : 'Select product'}
                      </AppText>
                      <AppText variant="caption" numberOfLines={1} className="mt-1">
                        {item.itemId ? `${unit} · Rs ${formatMoney(price)}/${item.unit || 'unit'}` : 'Tap to choose supplier product'}
                      </AppText>
                    </View>

                    <View className="h-12 w-[132px] flex-row items-center rounded-control border border-border bg-surface px-3">
                      {entryMode === 'amount' ? (
                        <AppText variant="small" className="mr-1">Rs</AppText>
                      ) : null}
                      <TextInput
                        value={entryMode === 'quantity' ? item.quantity : amountValue}
                        onChangeText={(value) => {
                          if (entryMode === 'quantity') {
                            updateItem(item.id, { quantity: value });
                          } else {
                            if (!/^\d*$/.test(value)) return;
                            setAmountDrafts((current) => ({ ...current, [item.id]: value }));
                            if (value && price > 0 && Number.isFinite(price)) {
                              updateItem(item.id, { quantity: String(Number(value) / price) });
                            } else {
                              updateItem(item.id, { quantity: '' });
                            }
                          }
                        }}
                        editable={!saving && !!item.itemId && (entryMode === 'quantity' || price > 0)}
                        keyboardType={entryMode === 'quantity' ? 'decimal-pad' : 'number-pad'}
                        placeholder={entryMode === 'quantity' ? 'Qty' : '0'}
                        placeholderTextColor="#9A9A93"
                        selectTextOnFocus
                        accessibilityLabel={`${entryMode === 'quantity' ? 'Quantity' : 'Amount'} for ${item.name}`}
                        className="min-w-0 flex-1 p-0 text-right font-sans text-[17px] text-foreground"
                      />
                    </View>

                    <Pressable
                      onPress={() => removeItem(item.id)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name || 'item'}`}
                      hitSlop={6}
                      className="h-9 w-8 items-center justify-center"
                    >
                      <Ionicons name="trash-outline" size={19} color="#777770" />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Show totals only after a supplier product has been selected. */}
            {selectedItems.length > 0 ? (
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

            ) : null}

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
              <View>
                <AppText className="font-spline-bold text-[19px] text-foreground">
                  {pickerRowId === '__new__' ? 'Add Item' : 'Change Item'}
                </AppText>
                <AppText className="mt-1 text-[12px] text-muted">
                  Products from this supplier only
                </AppText>
              </View>

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
                    className="min-h-[60px] flex-row items-center justify-between border-b border-border py-3"
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
                  No available supplier products found.
                </AppText>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}