
import { View } from 'react-native';

import {
  AppText,
  SyncStatusBadge,
} from '@/components/ui';

interface HomeHeaderProps {
  shopName: string;
  deviceName: string;
}

export function HomeHeader({
  shopName,
  deviceName,
}: HomeHeaderProps) {
  const subtitle = [
    shopName,
    deviceName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="min-h-[76px] flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <AppText
          variant="title"
          className="text-[24px] leading-[32px]"
        >
          Simple Khata
        </AppText>

        {subtitle ? (
          <AppText
            numberOfLines={1}
            className="mt-0.5 font-sans text-[14px] leading-[19px] text-muted"
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <SyncStatusBadge />
    </View>
  );
}
