
import { View } from 'react-native';

import { AppText } from '@/components/ui';

interface OutstandingSummaryProps {
  amount: number;
}

export function OutstandingSummary({
  amount,
}: OutstandingSummaryProps) {
  return (
    <View className="flex-row items-center justify-between gap-3 pb-7 pt-3">
      <AppText
        className="flex-1 font-spline-semibold text-[14px] leading-[20px] text-muted"
      >
        Total Outstanding
      </AppText>

      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        className="shrink font-spline-bold text-[36px] leading-[48px] text-foreground"
      >
        Rs {amount.toLocaleString()}
      </AppText>
    </View>
  );
}
