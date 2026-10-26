
import React, { useCallback } from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { ItemForm } from '@/components/item';

import { useItemForm } from '@/hooks/item/useItemForm';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

export default function NewItemScreen() {
  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
    reload: reloadIdentity,
  } = useShopIdentity();

  const {
    values,
    onChange,
    saving,
    error,
    save,
  } = useItemForm({
    shopId: shopId ?? '',
    deviceId: deviceId ?? '',
  });

  const handleSubmit = useCallback(async () => {
    if (identityLoading || !shopId || !deviceId || saving) {
      return;
    }

    const created = await save();

    if (created) {
      router.back();
    }
  }, [
    identityLoading,
    shopId,
    deviceId,
    saving,
    save,
  ]);

  if (identityLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator
          size="small"
          color="#242422"
        />
      </View>
    );
  }

  if (!shopId || !deviceId) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <Ionicons
          name="storefront-outline"
          size={38}
          color="#9A9A93"
        />

        <AppText className="mt-4 text-center font-spline-semibold text-[17px] text-foreground">
          Shop Unavailable
        </AppText>

        <AppText className="mt-2 text-center text-[13px] text-muted">
          {identityError ??
            'Shop or device identity is unavailable.'}
        </AppText>

        <Pressable
          onPress={() => void reloadIdentity()}
          accessibilityRole="button"
          className="mt-5 rounded-xl bg-chip px-6 py-3"
        >
          <AppText className="font-spline-semibold text-foreground">
            Try Again
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ItemForm
        values={values}
        onChange={onChange}
        onSubmit={() => {
          void handleSubmit();
        }}
        saving={saving}
        mode="create"
        error={error}
      />
    </View>
  );
}
