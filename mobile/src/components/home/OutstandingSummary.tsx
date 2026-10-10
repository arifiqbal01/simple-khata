
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { MoneySummary } from '@/components/ledger';

import { formatRupees } from '@/utils/ledger/format-rupees';

interface OutstandingSummaryProps {
  amount: number;
  moneyOut: number;
  moneyIn: number;
}

export function OutstandingSummary({
  amount,
  moneyOut,
  moneyIn,
}: OutstandingSummaryProps) {
  return (
    <View className="pb-7 pt-3">
      {/* Total Outstanding - single row */}
      <View className="mb-5 flex-row items-center justify-between gap-3">
        <AppText
          numberOfLines={1}
          className="shrink-0 font-spline-semibold text-[14px] leading-[20px] text-muted"
        >
          Total Outstanding
        </AppText>

        <View className="min-w-0 flex-1 flex-row items-baseline justify-end">
          <AppText className="mr-1 shrink-0 font-spline-semibold text-[16px] text-muted">
            Rs
          </AppText>

          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            className="min-w-0 shrink font-spline-bold text-[37px] leading-[46px] text-foreground"
          >
            {formatRupees(amount)}
          </AppText>
        </View>
      </View>

      {/* Reusable Money Out / Money In cards */}
      <MoneySummary
        moneyOut={moneyOut}
        moneyIn={moneyIn}
      />
    </View>
  );
}
