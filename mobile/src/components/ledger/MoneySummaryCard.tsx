
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

interface MoneySummaryCardProps {
  type: 'out' | 'in';
  amount: number;
}

export function MoneySummaryCard({
  type,
  amount,
}: MoneySummaryCardProps) {
  const isOut = type === 'out';

  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-border bg-surface px-3 py-3">
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={
            isOut
              ? 'arrow-up-outline'
              : 'arrow-down-outline'
          }
          size={16}
          color={isOut ? '#DC2626' : '#16A34A'}
        />

        <AppText
          numberOfLines={1}
          className="font-spline-medium text-[12px] text-muted"
        >
          {isOut ? 'Money Out' : 'Money In'}
        </AppText>
      </View>

      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        className="mt-2 font-spline-bold text-[20px] leading-[27px] text-foreground"
      >
        Rs {formatRupees(amount)}
      </AppText>
    </View>
  );
}
