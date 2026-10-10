
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export interface MoneySummaryCardProps {
  type: 'out' | 'in';
  amount: number;
}

export function MoneySummaryCard({
  type,
  amount,
}: MoneySummaryCardProps) {
  const isOut = type === 'out';

  return (
    <View className="min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-3">
      {/* Icon and label */}
      <View className="shrink-0 flex-row items-center gap-1">
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
          {isOut ? 'Out' : 'In'}
        </AppText>
      </View>

      {/* Amount */}
      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        className="min-w-0 flex-1 text-right font-spline-bold text-[17px] leading-[24px] text-foreground"
      >
        Rs {formatRupees(amount)}
      </AppText>
    </View>
  );
}
