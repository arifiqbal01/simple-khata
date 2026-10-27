
import React, { useState } from 'react';

import {
  Pressable,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { SyncStatusBadge } from '@/components/sync/SyncStatusBadge';

interface HomeHeaderProps {
  shopName: string;
  deviceName: string;
}

export function HomeHeader({
  shopName,
  deviceName,
}: HomeHeaderProps) {
  const [showDetails, setShowDetails] = useState(false);

  const shop = shopName?.trim() ?? '';
  const device = deviceName?.trim() ?? '';
  const hasDetails = Boolean(shop || device);

  return (
    <View className="pb-3 pt-1">
      <View className="min-h-[44px] flex-row items-center justify-between gap-3">
        <Pressable
          onPress={() => {
            if (hasDetails) {
              setShowDetails((previous) => !previous);
            }
          }}
          disabled={!hasDetails}
          accessibilityRole="button"
          accessibilityLabel="Show shop and device information"
          accessibilityState={{
            expanded: showDetails,
          }}
          className="min-w-0 flex-1 flex-row items-center gap-2"
        >
          <AppText
            numberOfLines={1}
            className="shrink font-spline-bold text-[23px] leading-[29px] tracking-[-0.8px] text-foreground"
          >
            Simple Khata
          </AppText>

          {hasDetails ? (
            <Ionicons
              name={
                showDetails
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={14}
              color="#9A9A93"
            />
          ) : null}
        </Pressable>

        <View className="shrink-0 items-end justify-center">
          <SyncStatusBadge />
        </View>
      </View>

      {showDetails && hasDetails ? (
        <View className="mt-3 flex-row items-center rounded-2xl border border-[#E9E9E5] bg-white px-3 py-3">
          <View className="mr-3 h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F3F0]">
            <Ionicons
              name="storefront-outline"
              size={19}
              color="#55554F"
            />
          </View>

          <View className="min-w-0 flex-1">
            {shop ? (
              <AppText
                numberOfLines={1}
                ellipsizeMode="tail"
                className="font-spline-semibold text-[14px] leading-[19px] text-foreground"
              >
                {shop}
              </AppText>
            ) : null}

            {device ? (
              <View className={shop ? 'mt-1 flex-row items-center gap-1' : 'flex-row items-center gap-1'}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={12}
                  color="#8A8A84"
                />

                <AppText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  className="flex-1 text-[11px] leading-[15px] text-muted"
                >
                  {device}
                </AppText>
              </View>
            ) : null}
          </View>

          <Ionicons
            name="information-circle-outline"
            size={17}
            color="#A3A39D"
          />
        </View>
      ) : null}
    </View>
  );
}
