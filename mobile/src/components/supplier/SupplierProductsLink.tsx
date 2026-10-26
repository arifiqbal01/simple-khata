
import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';

export interface SupplierProductsLinkProps {
  onPress: () => void;
  count?: number;
}

export function SupplierProductsLink({
  onPress,
  count,
}: SupplierProductsLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View supplier products"
      className="
        mt-3
        min-h-[48px]
        flex-row
        items-center
        rounded-[12px]
        bg-surface
        px-4
        active:opacity-70
      "
    >
      <Ionicons
        name="cube-outline"
        size={18}
        color="#242422"
      />

      <AppText
        className="
          ml-3
          flex-1
          font-spline-semibold
          text-[14px]
          text-foreground
        "
      >
        Products
      </AppText>

      {count !== undefined ? (
        <View className="mr-2 rounded-full bg-chip px-2 py-1">
          <AppText className="text-[12px] text-foreground">
            {count.toLocaleString()}
          </AppText>
        </View>
      ) : null}

      <Ionicons
        name="chevron-forward"
        size={16}
        color="#9A9A93"
      />
    </Pressable>
  );
}
