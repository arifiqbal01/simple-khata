import React from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';

export interface BalanceSummaryProps {
  balance: number;
  label?: string;
  size?: 'normal' | 'large';
  className?: string;
}

export function BalanceSummary({
  balance,
  label = 'Outstanding',
  size = 'normal',
  className = '',
}: BalanceSummaryProps) {
  return (
    <View className={className}>
      <AppText
        className="
          font-spline-semibold
          text-[13px]
          uppercase
          leading-[18px]
          text-muted
        "
      >
        {label}
      </AppText>

      <View className="mt-1 flex-row items-baseline">
        <AppText
          className="
            mr-2
            font-spline-semibold
            text-[22px]
            text-muted
          "
        >
          Rs
        </AppText>

        <AppText
          className={`
            font-spline-bold
            text-foreground
            ${
              size === 'large'
                ? 'text-[42px] leading-[50px]'
                : 'text-[32px] leading-[40px]'
            }
          `}
        >
          {balance.toLocaleString()}
        </AppText>
      </View>
    </View>
  );
}