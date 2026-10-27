
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import { AppHeader } from '@/components/layout';

import {
  AppText,
  Button,
  Screen,
} from '@/components/ui';

import {
  SupplierProductList,
  type SupplierProductRowData,
} from '@/components/supplier';

import { usePartyLedger } from '@/hooks/ledger/usePartyLedger';
import { useSupplierItems } from '@/hooks/supplier-item/useSupplierItems';

export default function SupplierProductsScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const supplierId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const {
    shopId,
    party,
    loading: supplierLoading,
    error: supplierError,
  } = usePartyLedger(supplierId, 'SUPPLIER');

  const {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useSupplierItems({
    shopId: shopId ?? '',
    supplierId: supplierId ?? '',
  });

  const [refreshing, setRefreshing] =
    useState(false);

  // Refresh products when returning to this screen.
  useFocusEffect(
    useCallback(() => {
      if (supplierId && shopId) {
        void refresh();
      }
    }, [supplierId, shopId, refresh])
  );

  // Convert repository items to list row data.
  const products: SupplierProductRowData[] =
    items.map((item) => ({
      id: item.id,
      itemId: item.item_id,
      itemName: item.item_name,
      unit: item.unit,
      unitPrice: item.unit_price,
    }));

  // Pull-to-refresh handler.
  const handleRefresh = useCallback(async () => {
    if (refreshing || !supplierId || !shopId) {
      return;
    }

    setRefreshing(true);

    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing,
    supplierId,
    shopId,
    refresh,
  ]);

  // Navigate to Add Supplier Product.
  const handleAddProduct = useCallback(() => {
    if (!supplierId) {
      return;
    }

    router.push({
      pathname: '/suppliers/[id]/products/add',
      params: {
        id: supplierId,
      },
    });
  }, [supplierId]);

  // Navigate to an existing supplier product.
  const handleOpenProduct = useCallback(
    (product: SupplierProductRowData) => {
      if (!supplierId) {
        return;
      }

      router.push({
        pathname:
          '/suppliers/[id]/products/[productId]',
        params: {
          id: supplierId,
          productId: product.id,
        },
      });
    },
    [supplierId]
  );

  // Load more products when pagination is available.
  const handleLoadMore = useCallback(() => {
    if (
      !supplierId ||
      !shopId ||
      loading ||
      loadingMore ||
      refreshing ||
      !hasMore
    ) {
      return;
    }

    void loadMore();
  }, [
    supplierId,
    shopId,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    loadMore,
  ]);

  if (supplierLoading && !party) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color="#242422"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={party?.name ?? 'Supplier Products'}
        showBack
        onBackPress={() => router.back()}
      />

      {supplierError || error ? (
        <View className="mx-5 mt-3 rounded-[12px] bg-udhaar-soft px-4 py-3">
          <AppText className="text-[13px] text-udhaar">
            {error ?? supplierError}
          </AppText>
        </View>
      ) : null}

      {/* Scrollable product list */}
      <View className="flex-1">
        <SupplierProductList
          products={products}
          loading={loading}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onOpenProduct={handleOpenProduct}
          onAddProduct={handleAddProduct}
        />

        {loadingMore ? (
          <ActivityIndicator
            className="my-3"
            color="#242422"
          />
        ) : null}
      </View>

      {/* Fixed bottom Add Item button */}
      <View className="border-t border-border bg-background px-5 pb-5 pt-3">
        <Button
          label="Add Item"
          variant="primary"
          onPress={handleAddProduct}
          disabled={!supplierId || !party}
          left={
            <Ionicons
              name="add"
              size={21}
              color="#FFFFFF"
            />
          }
        />
      </View>
    </Screen>
  );
}
