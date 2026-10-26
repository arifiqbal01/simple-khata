
import React from 'react';

import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  AppText,
  Screen,
  SaveButton,
  TextField,
} from '@/components/ui';

import {
  useCreateParty,
  type PartyType,
} from '@/hooks/party/useCreateParty';

interface PartyFormProps {
  partyType: PartyType;
}

export function PartyForm({
  partyType,
}: PartyFormProps) {
  const {
    name,
    setName,
    phone,
    setPhone,
    saving,
    canSave,
    save,
  } = useCreateParty(partyType);

  const isSupplier = partyType === 'SUPPLIER';

  const title = isSupplier
    ? 'New Supplier'
    : 'New Customer';

  const listPath = isSupplier
    ? '/suppliers'
    : '/customer';

  function handleClose(): void {
    Keyboard.dismiss();
    router.replace(listPath);
  }

  async function handleSave(): Promise<void> {
    if (!canSave) return;

    Keyboard.dismiss();

    try {
      const created = await save();

      if (created) {
        handleClose();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Could not add ${isSupplier ? 'supplier' : 'customer'}`;

      console.error(
        '[PartyForm] Save failed:',
        error
      );

      Alert.alert(
        `Could not add ${isSupplier ? 'supplier' : 'customer'}`,
        message
      );
    }
  }

  return (
    <Screen>
      {/* Fixed header */}
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            disabled={saving}
            className="h-10 w-9 items-center justify-center"
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color="#181816"
            />
          </Pressable>

          <AppText className="font-spline-semibold text-[19px] text-foreground">
            {title}
          </AppText>
        </View>

        <SaveButton
          loading={saving}
          disabled={!canSave}
          accessibilityLabel={`Save ${isSupplier ? 'supplier' : 'customer'}`}
          onPress={() => {
            void handleSave();
          }}
        />
      </View>

      {/* Scrollable form */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6">
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder={
                isSupplier
                  ? 'Supplier name'
                  : 'Customer name'
              }
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
            />

            <TextField
              label="Phone · Optional"
              value={phone}
              onChangeText={setPhone}
              placeholder="0300 1234567"
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSave) {
                  void handleSave();
                }
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
