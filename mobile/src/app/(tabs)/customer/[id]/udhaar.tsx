
import React, {
  useCallback,
  useEffect,
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

export default function AddUdhaarScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const customerId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const {
    customer,
    balance,
    amount,
    setAmount,

    items,
    availableItems,
    quickItems,
    selectedItems,
    draftItems,

    loading,
    saving,
    error,
    validAmount,
    parsedAmount,

    addItemRow,
    removeItem,
    clearItems,
    changeItemName,
    selectItem,
    toggleQuickItem,

    save,
    confirmItem,
  } = useAddUdhaar(customerId);

  const scrollRef = useRef<ScrollView>(null);

  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );

    const hide = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Always return to Home instead of previous
  // customer or Add Udhaar screens.
 const handleClose = useCallback(() => {
  Keyboard.dismiss();
  router.navigate('/(tabs)');
}, []);

  const handleSave = useCallback(async () => {
    if (!validAmount || saving) return;

    Keyboard.dismiss();

    try {
      const saved = await save();

      if (saved) {
        handleClose();
      }
    } catch (cause) {
      console.error(
        '[add-udhaar] save failed',
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
          <ActivityIndicator size="large" />
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
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#181816"
            />
          </Pressable>

          <AppText className="ml-4 font-spline-semibold text-[18px]">
            Add Udhaar
          </AppText>
        </View>

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {error ?? 'Customer could not be loaded.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  const selectedItemIds = items
    .map((item) => item.itemId)
    .filter(
      (id): id is string => id !== null
    );

  const selectedNames = items
    .filter(
      (item) => item.name.trim().length > 0
    )
    .map((item) => item.name);

  return (
    <Screen>
      {/* Fixed header */}
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleClose}
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
          disabled={!validAmount}
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
          {/* Customer + current balance */}
          <View className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-5">
            <View className="min-w-0 flex-1">
              <AppText
                numberOfLines={2}
                className="font-spline-bold text-[23px] leading-[29px] text-foreground"
              >
                {customer.name}
              </AppText>
            </View>

            <View className="items-end">
              <AppText className="font-spline-semibold text-[20px] text-foreground">
                Rs {balance.toLocaleString()}
              </AppText>

              <AppText className="mt-1 font-sans text-[12px] text-muted">
                Current balance
              </AppText>
            </View>
          </View>

          <View className="px-5">
            {/* Amount */}
            <View className="pt-6">
              <MoneyInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            {/* Items heading */}
            <View className="mt-8 flex-row items-center justify-between">
              <View className="flex-row items-baseline gap-1.5">
                <AppText className="font-spline-semibold text-[17px] text-foreground">
                  Items
                </AppText>

                <AppText className="text-[13px] text-muted">
                  Optional
                </AppText>
              </View>

              {selectedItems.length > 0 ? (
                <Pressable
                  onPress={clearItems}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all items"
                >
                  <AppText className="font-spline-medium text-[13px] text-udhaar">
                    Clear all
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            {/* Selected item summary */}
            <SelectedItems
              items={selectedItems}
              onRemove={removeItem}
            />

            {/* Customer/time-based suggestions */}
            <QuickItems
              items={quickItems}
              selectedNames={selectedNames}
              onToggle={toggleQuickItem}
            />

            {/* Custom item entry and catalog search */}
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

            {/* Amount summary */}
            {validAmount ? (
              <View className="mt-8 border-t border-border pt-4">
                <View className="flex-row items-center justify-between">
                  <AppText className="text-[13px] text-muted">
                    Udhaar amount
                  </AppText>

                  <AppText className="font-spline-semibold text-[16px] text-udhaar">
                    Rs {parsedAmount.toLocaleString()}
                  </AppText>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
