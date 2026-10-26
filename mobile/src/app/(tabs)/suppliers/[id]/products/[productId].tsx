
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { AppHeader } from '@/components/layout';

import {
  AppText,
  ConfirmModal,
  Screen,
} from '@/components/ui';

import { ItemUnitPicker } from '@/components/item';

import { usePartyLedger } from '@/hooks/ledger/usePartyLedger';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';
import { useItems } from '@/hooks/item/useItems';
import { useSupplierItem } from '@/hooks/supplier-item/useSupplierItem';
import { useSupplierItemForm } from '@/hooks/supplier-item/useSupplierItemForm';

export default function EditSupplierProductScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    productId?: string | string[];
  }>();

  const supplierId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const productId = Array.isArray(params.productId)
    ? params.productId[0]
    : params.productId;

  const [
    showRemoveConfirmation,
    setShowRemoveConfirmation,
  ] = useState(false);

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
  } = usePartyLedger(
    supplierId,
    'SUPPLIER'
  );

  const {
    item,
    loading: itemLoading,
    error: itemError,
  } = useSupplierItem({
    shopId: shopId ?? '',
    supplierItemId: productId ?? '',
  });

  // Resolve the catalog product name.
  const {
    items: catalogItems,
    loading: catalogLoading,
    loadingMore: catalogLoadingMore,
    hasMore: catalogHasMore,
    error: catalogError,
    loadMore: loadMoreCatalog,
  } = useItems({
    shopId: shopId ?? '',
  });

  const catalogItem = useMemo(
    () =>
      catalogItems.find(
        (catalogEntry) =>
          catalogEntry.id === item?.item_id
      ),
    [catalogItems, item?.item_id]
  );

  // Search additional catalog pages if needed.
  useEffect(() => {
    if (
      !shopId ||
      !item ||
      catalogItem ||
      catalogLoading ||
      catalogLoadingMore ||
      !catalogHasMore ||
      catalogError
    ) {
      return;
    }

    void loadMoreCatalog();
  }, [
    shopId,
    item,
    catalogItem,
    catalogLoading,
    catalogLoadingMore,
    catalogHasMore,
    catalogError,
    loadMoreCatalog,
  ]);

  const {
    values,
    onChange,
    saving,
    deleting,
    error: formError,
    save,
    deleteItem,
  } = useSupplierItemForm({
    shopId: shopId ?? '',
    deviceId: deviceId ?? '',
    supplierId: supplierId ?? '',
    supplierItem: item,
  });

  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (
      !shopId ||
      !deviceId ||
      !supplierId ||
      !party ||
      !item ||
      busy
    ) {
      return;
    }

    const success = await save();

    if (success) {
      router.back();
    }
  }, [
    shopId,
    deviceId,
    supplierId,
    party,
    item,
    busy,
    save,
  ]);

  // Open confirmation instead of using Alert.alert().
  const handleDelete = useCallback(() => {
    if (
      !shopId ||
      !deviceId ||
      !supplierId ||
      !party ||
      !item ||
      busy
    ) {
      return;
    }

    setShowRemoveConfirmation(true);
  }, [
    shopId,
    deviceId,
    supplierId,
    party,
    item,
    busy,
  ]);

  const handleCancelDelete = useCallback(() => {
    if (!deleting) {
      setShowRemoveConfirmation(false);
    }
  }, [deleting]);

  const handleConfirmDelete = useCallback(async () => {
    if (
      !shopId ||
      !deviceId ||
      !supplierId ||
      !item ||
      busy
    ) {
      return;
    }

    const success = await deleteItem();

    setShowRemoveConfirmation(false);

    if (success) {
      // Return to the supplier product list.
      // The list refreshes through useFocusEffect.
      router.back();
    }

    // On failure, remain on the edit screen.
    // useSupplierItemForm exposes the error as formError.
  }, [
    shopId,
    deviceId,
    supplierId,
    item,
    busy,
    deleteItem,
  ]);

  if (
    identityLoading ||
    supplierLoading ||
    itemLoading
  ) {
    return (
      <Screen>
        <AppHeader
          title="Edit Supplier Product"
          showBack
          onBackPress={() => router.back()}
        />

        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
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
          title="Edit Supplier Product"
          showBack
          onBackPress={() => router.back()}
        />

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {identityError ??
              'Shop or device identity is unavailable.'}
          </AppText>

          <Pressable
            onPress={() => {
              void reloadIdentity();
            }}
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

  if (!supplierId || !party || !item) {
    return (
      <Screen>
        <AppHeader
          title="Edit Supplier Product"
          showBack
          onBackPress={() => router.back()}
        />

        <View className="flex-1 items-center justify-center px-5">
          <AppText className="text-center text-udhaar">
            {supplierError ??
              itemError ??
              'Supplier product not found.'}
          </AppText>
        </View>
      </Screen>
    );
  }

  const catalogLookupInProgress =
    !catalogItem &&
    !catalogError &&
    (
      catalogLoading ||
      catalogLoadingMore ||
      catalogHasMore
    );

  const catalogDisplayName =
    catalogItem?.name ??
    (
      catalogLookupInProgress
        ? 'Loading item name...'
        : 'Catalog item unavailable'
    );

  return (
    <Screen>
      <AppHeader
        title="Edit Supplier Product"
        showBack
        onBackPress={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-5"
        keyboardShouldPersistTaps="handled"
      >
        {/* Error message */}
        {formError ? (
          <View className="mb-4 rounded-xl bg-udhaar-soft px-4 py-3">
            <AppText className="text-[13px] text-udhaar">
              {formError}
            </AppText>
          </View>
        ) : null}

        {/* Supplier */}
        <AppText className="mb-2 text-[13px] text-muted">
          Supplier
        </AppText>

        <AppText className="mb-5 text-[16px] font-spline-semibold text-foreground">
          {party.name}
        </AppText>

        {/* Catalog product */}
        <AppText className="mb-2 text-[13px] text-muted">
          Catalog Item
        </AppText>

        <View className="mb-5 rounded-xl bg-chip px-4 py-3">
          <AppText className="text-[16px] font-spline-semibold text-foreground">
            {catalogDisplayName}
          </AppText>

          {catalogLookupInProgress ? (
            <ActivityIndicator
              size="small"
              color="#242422"
              style={{ marginTop: 8 }}
            />
          ) : null}
        </View>

        {/* Purchase unit */}
        <View className="mb-5">
          <ItemUnitPicker
            label="Purchase Unit"
            value={values.unit}
            onChange={(unit) => {
              onChange('unit', unit);
            }}
            disabled={busy}
          />
        </View>

        {/* Purchase price */}
        <AppText className="mb-2 text-[13px] text-foreground">
          Purchase Price (PKR)
        </AppText>

        <TextInput
          value={values.unitPrice}
          onChangeText={(value) => {
            onChange('unitPrice', value);
          }}
          editable={!busy}
          placeholder="0"
          placeholderTextColor="#9A9A93"
          keyboardType="number-pad"
          className="mb-2 rounded-xl border border-border bg-surface px-4 py-3 text-[16px] text-foreground"
        />

        <AppText className="mb-6 text-[12px] text-muted">
          This purchase price applies only to this supplier.
          It does not change the catalog item's selling price.
        </AppText>

        {/* Save changes */}
        <Pressable
          disabled={busy}
          onPress={() => {
            void handleSave();
          }}
          accessibilityRole="button"
          accessibilityLabel="Save Changes"
          accessibilityState={{
            disabled: busy,
          }}
          className={`mb-4 min-h-[52px] items-center justify-center rounded-xl bg-foreground px-4 ${
            busy ? 'opacity-60' : ''
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AppText className="font-spline-semibold text-white">
              Save Changes
            </AppText>
          )}
        </Pressable>

        {/* Remove supplier product */}
        <Pressable
          disabled={busy}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Remove Product"
          accessibilityState={{
            disabled: busy,
          }}
          className={`min-h-[52px] items-center justify-center rounded-xl border border-red-300 px-4 ${
            busy ? 'opacity-60' : ''
          }`}
        >
          {deleting ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <AppText className="font-spline-semibold text-red-600">
              Remove Product
            </AppText>
          )}
        </Pressable>
      </ScrollView>

      {/* Shared confirmation modal */}
      <ConfirmModal
        visible={showRemoveConfirmation}
        title="Remove Supplier Product?"
        message="This product will be removed from this supplier only. The catalog product and historical ledger entries will remain unchanged."
        confirmText="Remove"
        cancelText="Cancel"
        destructive
        loading={deleting}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={handleCancelDelete}
      />
    </Screen>
  );
}
