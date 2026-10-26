
import React, {
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/layout';

import {
  AppText,
  Screen,
} from '@/components/ui';

import {
  SupplierProductForm,
  type SupplierCatalogItem,
} from '@/components/supplier';

import { usePartyLedger } from '@/hooks/ledger/usePartyLedger';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';
import { useItems } from '@/hooks/item/useItems';

import {
  useSupplierItemForm,
} from '@/hooks/supplier-item/useSupplierItemForm';

export default function AddSupplierProductScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const supplierId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
    reload: reloadIdentity,
  } = useShopIdentity();

  const {
    party,
    loading: supplierLoading,
    error: supplierError,
  } = usePartyLedger(supplierId, 'SUPPLIER');

  const {
    items: catalogItems,
    loading: loadingItems,
    loadingMore,
    hasMore,
    error: catalogError,
    loadMore,
  } = useItems({
    shopId: shopId ?? '',
  });

  const {
    values,
    onChange,
    saving,
    error: formError,
    save,
  } = useSupplierItemForm({
    shopId: shopId ?? '',
    deviceId: deviceId ?? '',
    supplierId: supplierId ?? '',
  });

  // Convert catalog records into the structure
  // expected by SupplierProductForm.
  const items: SupplierCatalogItem[] = useMemo(
    () =>
      catalogItems.map((item) => ({
        id: item.id,
        name: item.name,
        defaultUnit: item.default_unit ?? null,
      })),
    [catalogItems]
  );

  // Load all catalog pages so the product picker
  // can show products beyond the initial 50.
  useEffect(() => {
    if (
      !shopId ||
      loadingItems ||
      loadingMore ||
      !hasMore ||
      catalogError
    ) {
      return;
    }

    void loadMore();
  }, [
    shopId,
    loadingItems,
    loadingMore,
    hasMore,
    catalogError,
    loadMore,
  ]);

  const handleSubmit = useCallback(async () => {
    if (
      identityLoading ||
      supplierLoading ||
      !shopId ||
      !deviceId ||
      !supplierId ||
      !party ||
      saving
    ) {
      return;
    }

    const success = await save();

    if (success) {
      router.back();
    }
  }, [
    identityLoading,
    supplierLoading,
    shopId,
    deviceId,
    supplierId,
    party,
    saving,
    save,
  ]);

  if (identityLoading || supplierLoading) {
    return (
      <Screen>
        <AppHeader
          title="Add Supplier Product"
          showBack
          onBackPress={() => router.back()}
        />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="small"
            color="#242422"
          />
        </View>
      </Screen>
    );
  }

  if (!shopId || !deviceId) {
    return (
      <Screen>
        <AppHeader
          title="Add Supplier Product"
          showBack
          onBackPress={() => router.back()}
        />

        <View className="flex-1 items-center justify-center px-5">
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
      </Screen>
    );
  }

  if (!supplierId || !party) {
    return (
      <Screen>
        <AppHeader
          title="Add Supplier Product"
          showBack
          onBackPress={() => router.back()}
        />

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {supplierError ?? 'Supplier not found.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Add Supplier Product"
        showBack
        onBackPress={() => router.back()}
      />

      {catalogError ? (
        <View className="mx-5 mt-3 rounded-[12px] bg-udhaar-soft px-4 py-3">
          <AppText className="text-[13px] text-udhaar">
            {catalogError}
          </AppText>
        </View>
      ) : null}

      {loadingItems ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color="#242422"
          />
        </View>
      ) : (
        <SupplierProductForm
          values={values}
          items={items}
          onChange={onChange}
          onSubmit={() => {
            void handleSubmit();
          }}
          saving={saving}
          error={formError}
        />
      )}
    </Screen>
  );
}
