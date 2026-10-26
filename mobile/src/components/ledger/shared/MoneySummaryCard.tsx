
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export interface MoneySummaryCardProps {
  type: 'receive' | 'pay' | 'out' | 'in';
  amount: number;
}

export function MoneySummaryCard({
  type,
  amount,
}: MoneySummaryCardProps) {
  const isReceive = type === 'receive';
  const isPay = type === 'pay';

  const label = isReceive
    ? 'To Receive'
    : isPay
      ? 'To Pay'
      : type === 'out'
        ? 'Out'
        : 'In';

  const iconName: 'arrow-down-outline' | 'arrow-up-outline' =
    isReceive || type === 'in'
      ? 'arrow-down-outline'
      : 'arrow-up-outline';

  const iconColor =
    isReceive || type === 'in'
      ? '#16A34A'
      : '#DC2626';

  const safeAmount =
    Number.isFinite(amount) ? Math.max(0, amount) : 0;

  return (
    <View className="min-w-0 flex-1 flex-row items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-3 py-3">
      <View className="min-w-0 shrink flex-row items-center gap-1">
        <Ionicons
          name={iconName}
          size={16}
          color={iconColor}
        />

        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          className="font-spline-medium text-[12px] text-muted"
        >
          {label}
        </AppText>
      </View>

      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        className="min-w-0 flex-1 text-right font-spline-bold text-[17px] leading-[24px] text-foreground"
      >
        Rs {formatRupees(safeAmount)}
      </AppText>
    </View>
  );
}
