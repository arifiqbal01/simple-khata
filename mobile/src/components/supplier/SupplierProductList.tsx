
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, Button } from '@/components/ui';

import {
  SupplierProductRow,
  type SupplierProductRowData,
} from './SupplierProductRow';

export interface SupplierProductListProps {
  products: SupplierProductRowData[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onAddProduct: () => void;
  onOpenProduct: (product: SupplierProductRowData) => void;
}

export function SupplierProductList({
  products,
  loading = false,
  refreshing = false,
  onRefresh,
  onAddProduct,
  onOpenProduct,
}: SupplierProductListProps) {
  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        ) : undefined
      }
      ListHeaderComponent={
        <View className="mb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <AppText className="font-spline-semibold text-[15px] text-foreground">
              Supplier Products
            </AppText>

            <AppText className="text-[12px] text-muted">
              {products.length} items
            </AppText>
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <SupplierProductRow
          product={item}
          first={index === 0}
          last={index === products.length - 1}
          onPress={() => onOpenProduct(item)}
        />
      )}
      ListEmptyComponent={
        loading ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center px-4 py-16">
            <Ionicons
              name="cube-outline"
              size={36}
              color="#9A9A93"
            />

            <AppText className="mt-3 font-spline-semibold text-[15px] text-foreground">
              No products added
            </AppText>

            <AppText className="mt-2 text-center text-[13px] text-muted">
              Add items from your catalog and set
              this supplier's purchase prices.
            </AppText>

            <Pressable
              onPress={onAddProduct}
              accessibilityRole="button"
              className="mt-4 rounded-[10px] bg-chip px-4 py-3"
            >
              <AppText className="font-spline-semibold text-[13px] text-foreground">
                Add First Product
              </AppText>
            </Pressable>
          </View>
        )
      }
    />
  );
}
