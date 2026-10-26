
import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { AppText } from '@/components/ui';

import { BootstrapModeSelector } from './BootstrapModeSelector';
import { BootstrapField } from './BootstrapField';

import { useBootstrap } from '@/hooks/bootstrap/useBootstrap';

export function BootstrapForm() {
  const {
    mode,
    changeMode,
    shopId,
    setShopId,
    shopName,
    setShopName,
    deviceName,
    setDeviceName,
    isSaving,
    error,
    canContinue,
    handleContinue,
  } = useBootstrap();

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-8">
        <AppText className="text-3xl font-spline-semibold text-neutral-950">
          Simple Khata
        </AppText>

        <AppText className="mt-2 text-base text-neutral-500">
          Set up this device to get started.
        </AppText>
      </View>

      <BootstrapModeSelector
        mode={mode}
        disabled={isSaving}
        onChange={changeMode}
      />

      {mode === 'join' ? (
        <BootstrapField
          label="Shop ID"
          value={shopId}
          onChangeText={setShopId}
          placeholder="Enter existing shop UUID"
          autoCapitalize="none"
          editable={!isSaving}
        />
      ) : null}

      <BootstrapField
        label="Shop name"
        value={shopName}
        onChangeText={setShopName}
        placeholder="e.g. Iqbal Kiryana Store"
        editable={!isSaving}
      />

      <BootstrapField
        label="This device name"
        value={deviceName}
        onChangeText={setDeviceName}
        placeholder="e.g. Iqbal"
        editable={!isSaving}
      />

      <AppText className="mt-1 text-xs leading-5 text-neutral-400">
        Give this phone a recognizable name.
      </AppText>

      {error ? (
        <AppText
          accessibilityRole="alert"
          className="mt-4 text-sm text-red-600"
        >
          {error}
        </AppText>
      ) : null}

      <Pressable
        disabled={!canContinue}
        onPress={() => {
          void handleContinue();
        }}
        accessibilityRole="button"
        accessibilityState={{
          disabled: !canContinue,
          busy: isSaving,
        }}
        className={`mt-8 h-14 items-center justify-center rounded-2xl ${
          canContinue
            ? 'bg-neutral-950'
            : 'bg-neutral-200'
        }`}
      >
        {isSaving ? (
          <ActivityIndicator color="#181816" />
        ) : (
          <AppText
            className={`text-base font-spline-semibold ${
              canContinue
                ? 'text-white'
                : 'text-neutral-400'
            }`}
          >
            {mode === 'create'
              ? 'Create Shop'
              : 'Join Shop'}
          </AppText>
        )}
      </Pressable>
    </ScrollView>
  );
}
