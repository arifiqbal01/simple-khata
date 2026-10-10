import { View } from 'react-native';

import { MoneySummaryCard } from './MoneySummaryCard';

export interface MoneySummaryProps {
  moneyOut: number;
  moneyIn: number;
}

export function MoneySummary({
  moneyOut,
  moneyIn,
}: MoneySummaryProps) {
  return (
    <View className="flex-row gap-3">
      <MoneySummaryCard
        type="out"
        amount={moneyOut}
      />

      <MoneySummaryCard
        type="in"
        amount={moneyIn}
      />
    </View>
  );
}