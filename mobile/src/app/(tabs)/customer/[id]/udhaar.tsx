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
  Screen,
  SaveButton,
} from '@/components/ui';

import {
  ItemSearchSheet,
  NewItemSheet,
  SelectedItems,
  type NewUdhaarItemDetails,
} from '@/components/ledger/udhaar';

import { useAddUdhaar } from '@/hooks/ledger/useAddUdhaar';

import type { Item } from '@/types/domain';

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
    shopId,

    quickItems,
    selectedItems,

    mode,
    setMode,

    loading,
    saving,
    error,
    validAmount,
    parsedAmount,
    itemizedTotal,
    hasSelectedItems,

    addCatalogItem,
    addNewItem,
    removeItem,
    changeItemAmount,
    changeItemQuantity,
    changeItemUnit,
    changeItemUnitPrice,
    save,
  } = useAddUdhaar(customerId);

  const scrollRef = useRef<ScrollView>(null);
  const savingRef = useRef(false);

  const [keyboardVisible, setKeyboardVisible] =
    useState(false);

  const [itemSearchVisible, setItemSearchVisible] =
    useState(false);

  const [newItemVisible, setNewItemVisible] =
    useState(false);

  const [newItemName, setNewItemName] =
    useState('');

  const [openNewItemAfterDismiss, setOpenNewItemAfterDismiss] =
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

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    router.replace('/');
  }, []);

  const handleSave = useCallback(async () => {
    if (
      !hasSelectedItems ||
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
    hasSelectedItems,
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

  const handleOpenSearch = useCallback(() => {
    if (saving) {
      return;
    }

    Keyboard.dismiss();
    setItemSearchVisible(true);
  }, [saving]);

  const handleSelectCatalogItem = useCallback(
    (item: Item) => {
      addCatalogItem(item);
      setItemSearchVisible(false);
      scrollToItems();
    },
    [addCatalogItem, scrollToItems]
  );

  const handleOpenNewItemSheet = useCallback(
    (name: string) => {
      setNewItemName(name);
      setOpenNewItemAfterDismiss(true);
      setItemSearchVisible(false);
    },
    []
  );

  /*
   * Avoid displaying two native modals
   * simultaneously. Open the new-item sheet
   * after the search modal has closed.
   */
  useEffect(() => {
    if (
      !itemSearchVisible &&
      openNewItemAfterDismiss
    ) {
      const timeout = setTimeout(() => {
        setNewItemVisible(true);
        setOpenNewItemAfterDismiss(false);
      }, 350);

      return () => clearTimeout(timeout);
    }
  }, [
    itemSearchVisible,
    openNewItemAfterDismiss,
  ]);

  const handleAddNewItem = useCallback(
    (details: NewUdhaarItemDetails) => {
      addNewItem(details);
      setNewItemVisible(false);
      setNewItemName('');
      scrollToItems();
    },
    [addNewItem, scrollToItems]
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

          <AppText
            variant="heading"
            className="ml-4"
          >
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

          <AppText variant="heading">
            Add Udhaar
          </AppText>
        </View>

        <SaveButton
          loading={saving}
          disabled={!hasSelectedItems || !validAmount || saving}
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
                variant="heading"
                numberOfLines={2}
              >
                {customer.name}
              </AppText>
            </View>

            <View className="items-end">
              <AppText variant="bodyMedium">
                {formatMoney(balance)}
              </AppText>

              <AppText
                variant="caption"
                className="mt-1"
              >
                Current balance
              </AppText>
            </View>
          </View>

          <View className="px-5">
            {/* Show the read-only total only when items are selected. */}
            {hasSelectedItems ? (
              <View className="flex-row items-center justify-between border-b border-border py-3">
                <AppText variant="bodyMedium">
                  Total Udhaar
                </AppText>

                <AppText variant="money">
                  {formatMoney(itemizedTotal)}
                </AppText>
              </View>
            ) : null}

            {/* Add item action */}
            <Pressable
              onPress={handleOpenSearch}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Add item"
              className={`${hasSelectedItems ? 'mt-5' : 'mt-4'} flex-row items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-4 active:opacity-70`}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color="#181816"
              />

              <AppText variant="bodyMedium">
                Add Item
              </AppText>
            </Pressable>

            {/* Selected item rows */}
            <SelectedItems
              items={selectedItems}
              mode={mode}
              onChangeMode={setMode}
              onRemove={removeItem}
              onChangeAmount={changeItemAmount}
              onChangeQuantity={changeItemQuantity}
              onChangeUnit={changeItemUnit}
              onChangeUnitPrice={changeItemUnitPrice}
              disabled={saving}
            />

            {/* Balance summary */}
            {hasSelectedItems && validAmount && (
              <View className="mt-6 flex-row items-center justify-between border-t border-border py-4">
                <AppText variant="small">
                  Balance after Udhaar
                </AppText>

                <AppText variant="bodyMedium">
                  {formatMoney(balance + parsedAmount)}
                </AppText>
              </View>
            )}

            {hasSelectedItems && !validAmount && (
              <AppText
                variant="caption"
                className="mt-4 text-udhaar"
              >
                {mode === 'amount'
                  ? 'Enter a valid rupee amount for every selected item.'
                  : 'Enter a valid quantity, unit and selling price for every selected item.'}
              </AppText>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Search existing catalog items */}
      <ItemSearchSheet
        visible={itemSearchVisible}
        shopId={shopId}
        quickItems={quickItems}
        selectedItemIds={selectedItemIds}
        onClose={() => setItemSearchVisible(false)}
        onSelectItem={handleSelectCatalogItem}
        onCreateNew={handleOpenNewItemSheet}
      />

      {/* Create a new item */}
      <NewItemSheet
        visible={newItemVisible}
        initialName={newItemName}
        onClose={() => {
          setNewItemVisible(false);
          setNewItemName('');
        }}
        onAdd={handleAddNewItem}
      />
    </Screen>
  );
}