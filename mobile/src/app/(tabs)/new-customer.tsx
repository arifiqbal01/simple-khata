import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { AppHeader } from '@/components/layout';
import {
  Button,
  Screen,
  TextField,
} from '@/components/ui';

import { CustomerRepository } from '@/repositories/customer';
import { LocalIdentityRepository } from '@/repositories/local-identity';
import { ShopRepository } from '@/repositories/shop';
import {
  syncOutboxRepository,
} from '@/repositories/sync-outbox';

import { CreateCustomerService } from '@/services/customer/create';

const customerRepository =
  new CustomerRepository();

const shopRepository =
  new ShopRepository();

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

  function resetForm() {
      setName('');
      setPhone('');
    }

  function handleClose() {
    if (from === 'customers') {
      router.replace('/customers');
      return;
    }

    router.replace('/');
  }

  async function handleSave() {
  if (!canSave) {
    return;
  }

  try {
    setSaving(true);

    /*
     * Use the explicit identity for this installation.
     * Do not infer the local device from the devices table,
     * because it may also contain remote synced devices.
     */
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
      'Failed to add customer:',
      error
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <Screen>
        <AppHeader
          title="New Customer"
          showBack
          onBackPress={handleClose}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6">
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

        <View className="border-t border-border bg-background pb-5 pt-3">
          <Button
            label="Add Customer"
            loading={saving}
            disabled={!canSave}
            onPress={handleSave}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}