
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

  const accentColor = isReceive
    ? '#16A34A'
    : '#DC2626';

  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 py-3">
      <View className="mb-2 flex-row items-center gap-2">
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{
            backgroundColor: isReceive
              ? '#F0FDF4'
              : '#FEF2F2',
          }}
        >
          <Ionicons
            name={
              isReceive
                ? 'arrow-down-outline'
                : 'arrow-up-outline'
            }
            size={16}
            color={accentColor}
          />
        </View>

        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          className="min-w-0 flex-1 font-spline-medium"
          style={{
            color: '#737373',
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {label}
        </AppText>
      </View>

      <AppText
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        className="font-spline-bold"
        style={{
          color: '#242422',
          fontSize: 19,
          lineHeight: 26,
          fontVariant: ['tabular-nums'],
        }}
      >
        {amountsVisible
          ? `Rs ${formatRupees(safeAmount)}`
          : 'Rs ••••••'}
      </AppText>
    </View>
  );
}
