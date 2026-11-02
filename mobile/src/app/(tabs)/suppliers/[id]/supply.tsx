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
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { AppText, SaveButton, Screen } from '@/components/ui';
import {
  useAddSupply,
  type AvailableSupplyItem,
} from '@/hooks/ledger/useAddSupply';
import { SupplyItemFields } from '@/components/ledger/supply/SupplyItemFields';
import { SelectedSupplyItems } from '@/components/ledger/supply/SelectedSupplyItems';
import { SupplyItemSearchSheet } from '@/components/ledger/supply/SupplyItemSearchSheet';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString('en-PK', { maximumFractionDigits: 2 })
    : '0';
}

interface SupplyFormProps {
  supplierId?: string;
  from?: string;
  ledgerFrom?: string;
}

function SupplyForm({ supplierId, from, ledgerFrom }: SupplyFormProps) {
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
    mode,
    setMode,
    addItemRow,
    removeItem,
    updateItem,
    selectItem,
    save,
  } = useAddSupply(supplierId);

  const [searchVisible, setSearchVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const pendingSelection = useRef<{
    associationId: string;
    previousRowIds: Set<string>;
  } | null>(null);

  const selectedItems = useMemo(
    () => items.filter((item) => item.itemId !== null && item.name.trim().length > 0),
    [items]
  );

  const selectedItemIds = useMemo(
    () => selectedItems.map((item) => item.itemId as string),
    [selectedItems]
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    if (supplierId) {
      router.replace({
        pathname: '/suppliers/[id]',
        params: {
          id: supplierId,
          from: from === 'ledger' ? ledgerFrom ?? 'suppliers' : from ?? 'suppliers',
        },
      });
    } else {
      router.replace('/suppliers');
    }
  }, [supplierId, from, ledgerFrom]);

  const handleSelectProduct = useCallback(
    (product: AvailableSupplyItem) => {
      if (saving || pendingSelection.current) return;

      // Reject products outside the verified supplier catalog.
      if (!availableItems.some((entry) => entry.id === product.id)) return;
      if (selectedItemIds.includes(product.item_id)) return;

      const blankRow = items.find((item) => item.itemId === null);
      if (blankRow) {
        selectItem(blankRow.id, product.id); // Supplier association ID, not global item ID.
      } else {
        pendingSelection.current = {
          associationId: product.id,
          previousRowIds: new Set(items.map((item) => item.id)),
        };
        addItemRow();
      }
      setSearchVisible(false);
    },
    [saving, availableItems, selectedItemIds, items, selectItem, addItemRow]
  );

  // addItemRow returns void: select after React commits the newly created row.
  useEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    const row = items.find((item) => !pending.previousRowIds.has(item.id));
    if (!row) return;
    pendingSelection.current = null;
    selectItem(row.id, pending.associationId);
  }, [items, selectItem]);

  const handleSave = useCallback(async () => {
    if (!validAmount || selectedItems.length === 0 || saving || savingRef.current) return;
    savingRef.current = true;
    setSaveError(null);
    Keyboard.dismiss();

    try {
      const saved = await save();
      if (saved) {
        handleClose();
      } else {
        // useSaveSupply owns the detailed validation error.
        setSaveError('Could not record supply. Check the item details and try again.');
        Toast.show({ type: 'error', text1: 'Could not record supply' });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not record supply.';
      setSaveError(message);
      Toast.show({ type: 'error', text1: 'Could not record supply', text2: message });
    } finally {
      savingRef.current = false;
    }
  }, [validAmount, selectedItems.length, saving, save, handleClose]);

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#242422" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
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
            <Ionicons name="arrow-back" size={23} color="#181816" />
          </Pressable>
          <AppText className="font-spline-semibold text-[19px] text-foreground">
            Add Supply
          </AppText>
        </View>
        {supplier ? (
          <SaveButton
            loading={saving}
            disabled={!validAmount || selectedItems.length === 0 || saving}
            accessibilityLabel="Save Supply"
            onPress={() => void handleSave()}
          />
        ) : null}
      </View>

      {!supplier ? (
        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {error ?? 'Supplier could not be loaded.'}
          </AppText>
        </View>
      ) : (
        <>
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 48 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-5">
                <View className="min-w-0 flex-1">
                  <AppText
                    numberOfLines={2}
                    className="font-spline-bold text-[23px] leading-[29px] text-foreground"
                  >
                    {supplier.name}
                  </AppText>
                  <AppText className="mt-1 text-[12px] text-muted">Supplier</AppText>
                </View>
                <View className="items-end">
                  <AppText className="font-spline-semibold text-[20px] text-foreground">
                    Rs {formatMoney(balance)}
                  </AppText>
                  <AppText className="mt-1 text-[12px] text-muted">Current payable</AppText>
                </View>
              </View>

              <View className="px-5">
                <SupplyItemFields
                  onAdd={() => setSearchVisible(true)}
                  disabled={saving}
                  availableCount={availableItems.length}
                />

                <SelectedSupplyItems
                  items={selectedItems}
                  mode={mode}
                  onChangeMode={setMode}
                  onRemove={removeItem}
                  onChangeAmount={(id, amount) => updateItem(id, { amount })}
                  onChangeQuantity={(id, quantity) => updateItem(id, { quantity })}
                  disabled={saving}
                />

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
                      <AppText className="text-[13px] text-muted">Payable after supply</AppText>
                      <AppText className="font-spline-semibold text-[17px] text-udhaar">
                        Rs {formatMoney(projectedBalance)}
                      </AppText>
                    </View>
                  </View>
                ) : null}

                {saveError || error ? (
                  <View className="mt-5 rounded-xl border border-udhaar/20 bg-udhaar/5 px-4 py-3">
                    <AppText className="text-[14px] text-udhaar">{saveError ?? error}</AppText>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          <SupplyItemSearchSheet
            visible={searchVisible}
            availableItems={availableItems}
            selectedItemIds={selectedItemIds}
            onClose={() => setSearchVisible(false)}
            onSelectItem={handleSelectProduct}
            disabled={saving}
          />
        </>
      )}
    </Screen>
  );
}

export default function AddSupplyScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    ledgerFrom?: string | string[];
  }>();
  const supplierId = firstParam(params.id);

  // Remounting on supplier change prevents cross-supplier draft leakage.
  return (
    <SupplyForm
      key={supplierId ?? '__missing__'}
      supplierId={supplierId}
      from={firstParam(params.from)}
      ledgerFrom={firstParam(params.ledgerFrom)}
    />
  );
}
