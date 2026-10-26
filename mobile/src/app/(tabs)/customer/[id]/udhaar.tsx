
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

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import {
  AppText,
  MoneyInput,
  Screen,
  SaveButton,
} from '@/components/ui';

import { QuickItems } from '@/components/ledger/udhaar/QuickItems';
import { SelectedItems } from '@/components/ledger/udhaar/SelectedItems';
import { ItemSearchFields } from '@/components/ledger/udhaar/ItemSearchFields';

import { useAddUdhaar } from '@/hooks/ledger/useAddUdhaar';

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(value: number): string {
  return `Rs ${value.toLocaleString('en-PK')}`;
}

export default function AddUdhaarScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const customerId = firstParam(params.id);

  const {
    customer,
    balance,

    amount,
    setAmount,

    availableItems,
    quickItems,
    selectedItems,
    draftItems,

    loading,
    saving,
    error,
    validAmount,
    parsedAmount,
    itemizedTotal,
    hasSelectedItems,

    addItemRow,
    removeItem,
    clearItems,
    changeItemName,
    changeItemQuantity,
    changeItemUnit,
    changeItemUnitPrice,
    selectItem,
    toggleQuickItem,
    confirmItem,
    save,
  } = useAddUdhaar(customerId);

  const scrollRef = useRef<ScrollView>(null);
  const savingRef = useRef(false);

  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );

    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const selectedItemIds = useMemo(
    () =>
      selectedItems
        .map((item) => item.itemId)
        .filter(
          (id): id is string => id !== null
        ),
    [selectedItems]
  );

  const selectedNames = useMemo(
    () => selectedItems.map((item) => item.name),
    [selectedItems]
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    router.replace('/');
  }, []);

  const handleSave = useCallback(async () => {
    if (
      !validAmount ||
      saving ||
      savingRef.current
    ) {
      return;
    }

    savingRef.current = true;
    Keyboard.dismiss();

    try {
      const saved = await save();

      if (saved) {
        handleClose();
      }
    } catch (cause) {
      console.error(
        '[add-udhaar] Save failed:',
        cause
      );

      Toast.show({
        type: 'error',
        text1: 'Could not add Udhaar',
        text2:
          cause instanceof Error
            ? cause.message
            : 'Please try again.',
      });
    } finally {
      savingRef.current = false;
    }
  }, [
    validAmount,
    saving,
    save,
    handleClose,
  ]);

  const scrollToItems = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({
        animated: true,
      });
    });
  }, []);

  const handleAddItem = useCallback(() => {
    addItemRow();
    scrollToItems();
  }, [addItemRow, scrollToItems]);

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

  if (!customer) {
    return (
      <Screen>
        <View className="flex-row items-center px-4 py-4">
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go to Home"
            className="h-10 w-9 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#181816"
            />
          </Pressable>

          <AppText className="ml-4 font-spline-semibold text-[18px] text-foreground">
            Add Udhaar
          </AppText>
        </View>

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {error ??
              'Customer could not be loaded.'}
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
            accessibilityLabel="Go to Home"
            className="h-10 w-9 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#181816"
            />
          </Pressable>

          <AppText className="font-spline-semibold text-[19px] text-foreground">
            Add Udhaar
          </AppText>
        </View>

        <SaveButton
          loading={saving}
          disabled={!validAmount || saving}
          accessibilityLabel="Save Udhaar"
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
            paddingBottom: keyboardVisible
              ? 140
              : 40,
          }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Customer and balance */}
          <View className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
            <View className="min-w-0 flex-1">
              <AppText
                numberOfLines={2}
                className="font-spline-semibold text-[20px] text-foreground"
              >
                {customer.name}
              </AppText>
            </View>

            <View className="items-end">
              <AppText className="font-spline-semibold text-[18px] text-foreground">
                {formatMoney(balance)}
              </AppText>

              <AppText className="mt-1 text-[12px] text-muted">
                Current balance
              </AppText>
            </View>
          </View>

          <View className="px-5">
            {/* Compact amount */}
            <View className="pt-5">
              {hasSelectedItems ? (
                <View className="flex-row items-center justify-between border-b border-border py-3">
                  <AppText className="font-spline-medium text-[15px] text-muted">
                    Calculated Udhaar
                  </AppText>

                  <AppText className="font-spline-semibold text-[21px] text-foreground">
                    {formatMoney(itemizedTotal)}
                  </AppText>
                </View>
              ) : (
                <MoneyInput
                  label="Amount"
                  value={amount}
                  onChangeText={setAmount}
                />
              )}
            </View>

            {/* Selected items */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between">
                <AppText className="font-spline-semibold text-[16px] text-foreground">
                  Items
                </AppText>

                {selectedItems.length > 0 ? (
                  <Pressable
                    onPress={clearItems}
                    disabled={saving}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all items"
                  >
                    <AppText className="font-spline-medium text-[12px] text-udhaar">
                      Clear all
                    </AppText>
                  </Pressable>
                ) : null}
              </View>

              <SelectedItems
                items={selectedItems}
                onRemove={removeItem}
                onChangeQuantity={
                  changeItemQuantity
                }
                onChangeUnit={changeItemUnit}
                onChangeUnitPrice={
                  changeItemUnitPrice
                }
              />
            </View>

            {/* Quick Items */}
            <QuickItems
              items={quickItems}
              selectedNames={selectedNames}
              onToggle={toggleQuickItem}
            />

            {/* Search / Add item */}
            <ItemSearchFields
              drafts={draftItems}
              availableItems={availableItems}
              selectedItemIds={selectedItemIds}
              onChangeName={changeItemName}
              onSelectItem={selectItem}
              onConfirm={confirmItem}
              onRemove={removeItem}
              onAdd={handleAddItem}
              onFocusField={scrollToItems}
            />

            {/* Minimal balance summary */}
            {validAmount ? (
              <View className="mt-6 flex-row items-center justify-between border-t border-border py-4">
                <AppText className="text-[13px] text-muted">
                  Balance after Udhaar
                </AppText>

                <AppText className="font-spline-semibold text-[16px] text-foreground">
                  {formatMoney(
                    balance + parsedAmount
                  )}
                </AppText>
              </View>
            ) : null}

            {hasSelectedItems &&
            !validAmount ? (
              <AppText className="mt-4 text-[12px] text-udhaar">
                Enter a valid quantity, unit and
                selling price for every selected item.
              </AppText>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
