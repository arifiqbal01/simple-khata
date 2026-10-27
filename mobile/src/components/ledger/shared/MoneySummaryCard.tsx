
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

export interface MoneySummaryCardProps {
  type: 'receive' | 'pay' | 'out' | 'in';
  amount: number;
  amountsVisible?: boolean;
}

export function MoneySummaryCard({
  type,
  amount,
  amountsVisible = true,
}: MoneySummaryCardProps) {
  const isReceive =
    type === 'receive' || type === 'in';

  const label =
    type === 'receive'
      ? 'To Receive'
      : type === 'pay'
        ? 'To Pay'
        : type === 'out'
          ? 'Out'
          : 'In';

  const safeAmount = Number.isFinite(amount)
    ? Math.max(0, amount)
    : 0;

  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 py-3">
      {/* Label and direction */}
      <View className="mb-2 flex-row items-center gap-2">
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${
            isReceive
              ? 'bg-green-50'
              : 'bg-red-50'
          }`}
        >
          <Ionicons
            name={
              isReceive
                ? 'arrow-down-outline'
                : 'arrow-up-outline'
            }
            size={16}
            color={
              isReceive
                ? '#16A34A'
                : '#DC2626'
            }
          />
        </View>

        <AppText
          className="min-w-0 flex-1 font-spline-medium text-[12px] text-muted"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {label}
        </AppText>
      </View>

      {/* Amount */}
      <AppText
        className="font-spline-bold text-[20px] leading-[27px] text-foreground"
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {amountsVisible
          ? `Rs ${formatRupees(safeAmount)}`
          : 'Rs ••••••'}
      </AppText>
    </View>
  );
}
