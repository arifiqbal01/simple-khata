
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { MoneySummary } from '@/components/ledger';

import { formatRupees } from '@/utils/ledger/format-rupees';

interface OutstandingSummaryProps {
  toReceive?: number;
  toPay?: number;

  // Legacy props retained for existing callers.
  amount?: number;
  moneyOut?: number;
  moneyIn?: number;
}

export function OutstandingSummary({
  toReceive,
  toPay,
  amount = 0,
  moneyOut = 0,
  moneyIn = 0,
}: OutstandingSummaryProps) {
  const isPartySummary =
    toReceive !== undefined && toPay !== undefined;

  const receivable = Math.max(0, toReceive ?? 0);
  const payable = Math.max(0, toPay ?? 0);

  const netBalance = isPartySummary
    ? receivable - payable
    : amount;

  const isNegative = netBalance < 0;

  return (
    <View className="pb-7 pt-3">
      <View className="mb-5 flex-row items-center justify-between gap-3">
        <AppText
          numberOfLines={1}
          className="shrink-0 font-spline-semibold text-[14px] leading-[20px] text-muted"
        >
          {isPartySummary
            ? 'Net Balance'
            : 'Total Outstanding'}
        </AppText>

        <View className="min-w-0 flex-1 flex-row items-baseline justify-end">
          {isNegative ? (
            <AppText className="mr-1 font-spline-semibold text-[16px] text-muted">
              −
            </AppText>
          ) : null}

          <AppText className="mr-1 shrink-0 font-spline-semibold text-[16px] text-muted">
            Rs
          </AppText>

          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            className="min-w-0 shrink font-spline-bold text-[37px] leading-[46px] text-foreground"
          >
            {formatRupees(Math.abs(netBalance))}
          </AppText>
        </View>
      </View>

      {isPartySummary ? (
        <MoneySummary
          toReceive={receivable}
          toPay={payable}
        />
      ) : (
        <MoneySummary
          moneyOut={moneyOut}
          moneyIn={moneyIn}
        />
      )}
    </View>
  );
}
