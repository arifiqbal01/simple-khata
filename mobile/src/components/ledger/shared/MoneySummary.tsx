
import { View } from 'react-native';

import { MoneySummaryCard } from './MoneySummaryCard';

export interface MoneySummaryProps {
  toReceive?: number;
  toPay?: number;
  moneyOut?: number;
  moneyIn?: number;
}

export function MoneySummary({
  toReceive,
  toPay,
  moneyOut = 0,
  moneyIn = 0,
}: MoneySummaryProps) {
  const isPartySummary =
    toReceive !== undefined || toPay !== undefined;

  return (
    <View className="flex-row gap-3">
      <MoneySummaryCard
        type={isPartySummary ? 'receive' : 'out'}
        amount={
          isPartySummary ? (toReceive ?? 0) : moneyOut
        }
      />

      <MoneySummaryCard
        type={isPartySummary ? 'pay' : 'in'}
        amount={
          isPartySummary ? (toPay ?? 0) : moneyIn
        }
      />
    </View>
  );
}
