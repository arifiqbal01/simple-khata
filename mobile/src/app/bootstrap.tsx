import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DeviceRepository } from '@/repositories/device';
import { ShopRepository } from '@/repositories/shop';
import { BootstrapDeviceService } from '@/services/bootstrap/device';

type BootstrapMode = 'create' | 'join';

const bootstrapService =
  new BootstrapDeviceService(
    new ShopRepository(),
    new DeviceRepository()
  );

export default function BootstrapScreen() {
  const [mode, setMode] =
    useState<BootstrapMode>('create');

  const [shopId, setShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [deviceName, setDeviceName] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const canContinue =
    shopName.trim().length > 0 &&
    deviceName.trim().length > 0 &&
    (mode === 'create' ||
      shopId.trim().length > 0) &&
    !isSaving;

  async function handleContinue() {
    if (!canContinue) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const identity =
        mode === 'create'
          ? await bootstrapService.createShop({
              shopName,
              deviceName,
            })
          : await bootstrapService.joinShop({
              shopId,
              shopName,
              deviceName,
            });

      console.log('Bootstrap complete:', {
        mode,
        shopId: identity.shop.id,
        shopName: identity.shop.name,
        deviceId: identity.device.id,
        deviceName: identity.device.name,
      });

      router.replace('/');
    } catch (err) {
      console.error(
        'Bootstrap failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Could not set up this device'
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-6">
      <View className="flex-1 justify-center">
        <View className="mb-8">
          <Text className="text-3xl font-semibold text-neutral-950">
            Simple Khata
          </Text>

          <Text className="mt-2 text-base text-neutral-500">
            Set up this device to get started.
          </Text>
        </View>

        <View className="mb-8 flex-row rounded-2xl bg-neutral-100 p-1">
          <ModeButton
            label="Create shop"
            selected={mode === 'create'}
            onPress={() => {
              setMode('create');
              setError(null);
            }}
          />

          <ModeButton
            label="Join shop"
            selected={mode === 'join'}
            onPress={() => {
              setMode('join');
              setError(null);
            }}
          />
        </View>

        {mode === 'join' ? (
          <Field
            label="Shop ID"
            value={shopId}
            onChangeText={setShopId}
            placeholder="Enter existing shop UUID"
            editable={!isSaving}
          />
        ) : null}

        <Field
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          placeholder="e.g. Iqbal Kiryana Store"
          editable={!isSaving}
        />

        <Field
          label="This device name"
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="e.g. Iqbal"
          editable={!isSaving}
        />

        <Text className="mt-1 text-xs leading-5 text-neutral-400">
          Give this phone a recognizable name.
        </Text>

        {error ? (
          <Text className="mt-4 text-sm text-red-600">
            {error}
          </Text>
        ) : null}

        <Pressable
          disabled={!canContinue}
          onPress={handleContinue}
          className={`mt-8 h-14 items-center justify-center rounded-2xl ${
            canContinue
              ? 'bg-neutral-950'
              : 'bg-neutral-200'
          }`}
        >
          {isSaving ? (
            <ActivityIndicator />
          ) : (
            <Text
              className={`text-base font-semibold ${
                canContinue
                  ? 'text-white'
                  : 'text-neutral-400'
              }`}
            >
              {mode === 'create'
                ? 'Create Shop'
                : 'Join Shop'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

interface ModeButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function ModeButton({
  label,
  selected,
  onPress,
}: ModeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-xl px-3 py-3 ${
        selected
          ? 'bg-white'
          : 'bg-transparent'
      }`}
    >
      <Text
        className={`text-sm font-semibold ${
          selected
            ? 'text-neutral-950'
            : 'text-neutral-500'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder: string;
  editable: boolean;
  onChangeText: (value: string) => void;
}

function Field({
  label,
  value,
  placeholder,
  editable,
  onChangeText,
}: FieldProps) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-medium text-neutral-700">
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        autoCapitalize="words"
        className="h-14 rounded-2xl border border-neutral-200 bg-white px-4 text-base text-neutral-950"
      />
    </View>
  );
}