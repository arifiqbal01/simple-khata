
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  AppText,
  Button,
  ConfirmModal,
} from '@/components/ui';

import { ItemForm } from '@/components/item';

import { useItem } from '@/hooks/item/useItem';
import { useItemForm } from '@/hooks/item/useItemForm';
import { useShopIdentity } from '@/hooks/shop/useShopIdentity';

export default function EditItemScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const id = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [
    showDeleteConfirmation,
    setShowDeleteConfirmation,
  ] = useState(false);

  const {
    shopId,
    deviceId,
    loading: identityLoading,
    error: identityError,
    reload: reloadIdentity,
  } = useShopIdentity();

  const {
    item,
    loading: itemLoading,
    error: loadError,
    refresh,
  } = useItem({
    shopId: shopId ?? '',
    itemId: id ?? '',
  });

  const {
    values,
    onChange,
    saving,
    deleting,
    error: formError,
    save,
    deleteItem,
  } = useItemForm({
    shopId: shopId ?? '',
    deviceId: deviceId ?? '',
    item,
  });

  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (
      identityLoading ||
      !shopId ||
      !deviceId ||
      !item ||
      busy
    ) {
      return;
    }

    const updated = await save();

    if (updated) {
      router.back();
    }
  }, [
    identityLoading,
    shopId,
    deviceId,
    item,
    busy,
    save,
  ]);

  /*
   * Open the shared confirmation modal.
   * Do not use Alert.alert() or
   * confirmItemDeletion().
   */
  const handleDelete = useCallback(() => {
    if (
      identityLoading ||
      !shopId ||
      !deviceId ||
      !item ||
      busy
    ) {
      return;
    }

    setShowDeleteConfirmation(true);
  }, [
    identityLoading,
    shopId,
    deviceId,
    item,
    busy,
  ]);

  const handleCancelDelete = useCallback(() => {
    if (!deleting) {
      setShowDeleteConfirmation(false);
    }
  }, [deleting]);

  /*
   * Execute the actual deletion only after
   * the user confirms.
   */
  const handleConfirmDelete =
    useCallback(async () => {
      if (
        identityLoading ||
        !shopId ||
        !deviceId ||
        !item ||
        busy
      ) {
        return;
      }

      const deleted = await deleteItem();

      if (deleted) {
        setShowDeleteConfirmation(false);
        router.back();
      }

      /*
       * If deletion fails, close the modal
       * so the formError from useItemForm
       * is visible on the edit screen.
       */
      if (!deleted) {
        setShowDeleteConfirmation(false);
      }
    }, [
      identityLoading,
      shopId,
      deviceId,
      item,
      busy,
      deleteItem,
    ]);

  if (
    identityLoading ||
    (shopId && itemLoading)
  ) {
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
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <Ionicons
          name="cube-outline"
          size={38}
          color="#9A9A93"
        />

        <AppText className="mt-4 text-center font-spline-semibold text-[17px] text-foreground">
          Item Unavailable
        </AppText>

        <AppText className="mt-2 text-center text-[13px] text-muted">
          {loadError ?? 'Item not found.'}
        </AppText>

        <View className="mt-5 w-full">
          <Button
            label="Try Again"
            onPress={refresh}
          />
        </View>

        <View className="mt-3 w-full">
          <Button
            label="Go Back"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ItemForm
        values={values}
        onChange={onChange}
        onSubmit={() => {
          void handleSave();
        }}
        saving={saving}
        deleting={deleting}
        mode="edit"
        error={formError}
        onDelete={handleDelete}
      />

      <ConfirmModal
        visible={showDeleteConfirmation}
        title="Delete Catalog Item?"
        message={`Are you sure you want to delete "${item.name}"? The item will be removed from the active catalog. Historical ledger entries will remain unchanged.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        loading={deleting}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={handleCancelDelete}
      />
    </View>
  );
}
