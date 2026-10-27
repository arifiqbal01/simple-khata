
import { View } from 'react-native';

import { MoneySummaryCard } from './MoneySummaryCard';

export interface MoneySummaryProps {
  toReceive?: number;
  toPay?: number;
  moneyOut?: number;
  moneyIn?: number;
  amountsVisible?: boolean;
}

export function MoneySummary({
  toReceive,
  toPay,
  moneyOut = 0,
  moneyIn = 0,
  amountsVisible = true,
}: MoneySummaryProps) {
  const isPartySummary =
    toReceive !== undefined ||
    toPay !== undefined;

  return (
    <View className="flex-row gap-3">
      <MoneySummaryCard
        type={
          isPartySummary
            ? 'receive'
            : 'out'
        }
        amount={
          isPartySummary
            ? (toReceive ?? 0)
            : moneyOut
        }
        amountsVisible={amountsVisible}
      />

      <MoneySummaryCard
        type={
          isPartySummary
            ? 'pay'
            : 'in'
        }
        amount={
          isPartySummary
            ? (toPay ?? 0)
            : moneyIn
        }
        amountsVisible={amountsVisible}
      />
    </View>
  );
}
