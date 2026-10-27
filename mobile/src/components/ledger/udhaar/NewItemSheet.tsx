
import React, {
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  TextField,
} from '@/components/ui';

import { ItemUnitPicker } from '@/components/item/ItemUnitPicker';

export interface NewUdhaarItemDetails {
  name: string;
  unit: string;
  defaultSellingPrice: number | null;
}

export interface NewItemSheetProps {
  visible: boolean;
  initialName?: string;
  onClose: () => void;
  onAdd: (details: NewUdhaarItemDetails) => void;
}

const MAX_NAME_LENGTH = 150;

function parseOptionalPrice(
  value: string
): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

export const NewItemSheet = memo(
  function NewItemSheet({
    visible,
    initialName = '',
    onClose,
    onAdd,
  }: NewItemSheetProps) {
    const insets = useSafeAreaInsets();

    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [price, setPrice] = useState('');

    const [submitting, setSubmitting] =
      useState(false);

    useEffect(() => {
      if (visible) {
        setName(initialName.trim());
        setUnit('');
        setPrice('');
        setSubmitting(false);
      }
    }, [visible, initialName]);

    const trimmedName = name.trim();
    const trimmedPrice = price.trim();

    const parsedPrice =
      parseOptionalPrice(price);

    const nameValid =
      trimmedName.length > 0 &&
      trimmedName.length <= MAX_NAME_LENGTH;

    const priceValid =
      trimmedPrice.length === 0 ||
      parsedPrice !== null;

    const canAdd =
      nameValid &&
      priceValid &&
      !submitting;

    const closeSheet = useCallback(() => {
      if (submitting) {
        return;
      }

      Keyboard.dismiss();
      onClose();
    }, [submitting, onClose]);

    const handleAdd = useCallback(() => {
      if (!canAdd) {
        return;
      }

      setSubmitting(true);
      Keyboard.dismiss();

      try {
        onAdd({
          name: trimmedName,
          unit,
          defaultSellingPrice: parsedPrice,
        });
      } finally {
        setSubmitting(false);
      }
    }, [
      canAdd,
      trimmedName,
      unit,
      parsedPrice,
      onAdd,
    ]);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <View className="flex-1 justify-end">
            <Pressable
              className="absolute inset-0 bg-black/50"
              onPress={closeSheet}
              accessibilityRole="button"
              accessibilityLabel="Close new item form"
            />

            <View
              className="max-h-[90%] overflow-hidden rounded-t-3xl bg-background"
              style={{
                paddingBottom: Math.max(
                  insets.bottom,
                  16
                ),
              }}
            >
              {/* Header */}
              <View className="flex-row items-start justify-between px-5 pb-4 pt-5">
                <View className="min-w-0 flex-1 pr-4">
                  <AppText variant="heading">
                    New Item
                  </AppText>

                  <AppText
                    variant="body"
                    className="mt-1 text-muted"
                  >
                    Add an item to your catalog
                  </AppText>
                </View>

                <Pressable
                  onPress={closeSheet}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={10}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Ionicons
                    name="close"
                    size={26}
                    color="#242422"
                  />
                </Pressable>
              </View>

              {/* Scrollable form */}
              <ScrollView
                className="min-h-0"
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingTop: 8,
                  paddingBottom: 20,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === 'ios'
                    ? 'interactive'
                    : 'on-drag'
                }
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={
                  Platform.OS === 'ios'
                }
              >
                <TextField
                  label="Item name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter item name"
                  autoCapitalize="words"
                  maxLength={MAX_NAME_LENGTH}
                  editable={!submitting}
                  returnKeyType="done"
                />

                <View className="mt-5">
                  <ItemUnitPicker
                    label="Unit (optional)"
                    value={unit}
                    onChange={setUnit}
                    optional
                    disabled={submitting}
                  />
                </View>

                <View className="mt-5">
                  <TextField
                    label="Default selling price (optional)"
                    value={price}
                    onChangeText={(value) => {
                      setPrice(
                        value.replace(/[^\d]/g, '')
                      );
                    }}
                    placeholder="Rs 0"
                    keyboardType="number-pad"
                    editable={!submitting}
                    error={
                      !priceValid
                        ? 'Enter a valid whole-rupee price.'
                        : undefined
                    }
                  />
                </View>

                <AppText
                  variant="caption"
                  className="mt-4 text-muted"
                >
                  The default price is only a
                  suggestion. You can enter a
                  different price or an exact rupee
                  amount when adding Udhaar.
                </AppText>
              </ScrollView>

              {/* Footer stays outside the form scroll */}
              <View className="border-t border-border bg-background px-5 pb-2 pt-4">
                <Button
                  label="Add Item"
                  onPress={handleAdd}
                  disabled={!canAdd}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
);
