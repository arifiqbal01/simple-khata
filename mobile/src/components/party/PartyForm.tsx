
import React, { useCallback } from 'react';

import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
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

  const listPath = isSupplier
    ? '/suppliers'
    : '/customer';

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave || saving) {
      return;
    }

    Keyboard.dismiss();

    try {
      const created = await save();

      if (created) {
        router.replace(listPath);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Could not add ${
              isSupplier ? 'supplier' : 'customer'
            }`;

      console.error(
        '[PartyForm] Save failed:',
        error
      );

      Alert.alert(
        `Could not add ${
          isSupplier ? 'supplier' : 'customer'
        }`,
        message
      );
    }
  }, [
    canSave,
    saving,
    save,
    listPath,
    isSupplier,
  ]);

  return (
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
              if (canSave && !saving) {
                void handleSave();
              }
            }}
          />
        </View>
      </ScrollView>

      <View className="border-t border-border bg-background px-5 pb-4 pt-3">
        <SaveButton
          loading={saving}
          disabled={!canSave || saving}
          accessibilityLabel={`Save ${
            isSupplier ? 'supplier' : 'customer'
          }`}
          onPress={() => {
            void handleSave();
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
