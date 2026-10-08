
import React, { useState } from 'react';

import {
  Alert,
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

import {
  AppText,
  Screen,
  SaveButton,
  TextField,
} from '@/components/ui';

import { CustomerRepository } from '@/repositories/customer';

import { LocalIdentityRepository } from '@/repositories/local-identity';

import {
  syncOutboxRepository,
} from '@/repositories/sync-outbox';

import { CreateCustomerService } from '@/services/customer/create';

const customerRepository =
  new CustomerRepository();

const localIdentityRepository =
  new LocalIdentityRepository();

const createCustomerService =
  new CreateCustomerService(
    customerRepository,
    syncOutboxRepository
  );

export default function NewCustomerScreen() {
  const params = useLocalSearchParams<{
    from?: string | string[];
  }>();

  const from = Array.isArray(params.from)
    ? params.from[0]
    : params.from;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [saving, setSaving] =
    useState(false);

  const trimmedName = name.trim();

  const canSave =
    trimmedName.length > 0 &&
    !saving;

  function resetForm(): void {
    setName('');
    setPhone('');
  }

  function handleClose(): void {
    Keyboard.dismiss();

    if (from === 'customers') {
      router.replace('/customers');
      return;
    }

    router.replace('/');
  }

  async function handleSave(): Promise<void> {
    if (!canSave) return;

    Keyboard.dismiss();

    try {
      setSaving(true);

      // Use this installation's local identity.
      const identity =
        await localIdentityRepository.get();

      if (!identity) {
        throw new Error(
          'Local installation identity not found'
        );
      }

      await createCustomerService.execute({
        shopId: identity.shopId,
        deviceId: identity.deviceId,
        name: trimmedName,
        phone: phone.trim() || null,
      });

      resetForm();
      handleClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not add customer';

      Alert.alert(
        'Could not add customer',
        message
      );

      console.error(
        '[new-customer] save failed',
        error
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      {/* Fixed header - same as Add Udhaar */}
      <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleClose}
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
            New Customer
          </AppText>
        </View>

        <SaveButton
          loading={saving}
          disabled={!canSave}
          accessibilityLabel="Save customer"
          onPress={() => {
            void handleSave();
          }}
        />
      </View>

      {/* Scrollable customer form */}
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
            {/* Customer name */}
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Customer name"
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
            />

            {/* Optional phone number */}
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
