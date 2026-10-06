import React from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import type { CustomerWithBalance } from '@/repositories/customer';

export interface CustomerRowProps {
  customer: CustomerWithBalance;
  first?: boolean;
  last?: boolean;
  onQuickUdhaar: () => void;
  onOpenCustomer: () => void;
}

export function CustomerRow({
  customer,
  first = false,
  last = false,
  onQuickUdhaar,
  onOpenCustomer,
}: CustomerRowProps) {
  return (
    <View
      className={`
        min-h-[92px]
        flex-row
        items-stretch
        border-border
        bg-surface
        ${first ? 'rounded-t-[16px]' : ''}
        ${last ? 'rounded-b-[16px]' : ''}
        ${!last ? 'border-b' : ''}
      `}
    >
      <Pressable
        onPress={onQuickUdhaar}
        accessibilityRole="button"
        accessibilityLabel={`Add udhaar for ${customer.name}`}
        className="
          min-w-0
          flex-1
          justify-center
          py-4
          pl-5
          pr-3
          active:bg-chip
        "
      >
        <AppText
          numberOfLines={1}
          className="
            font-spline-semibold
            text-[18px]
            leading-[24px]
            text-foreground
          "
        >
          {customer.name}
        </AppText>

        <AppText
          numberOfLines={1}
          className="
            mt-1
            font-sans
            text-[15px]
            leading-[20px]
            text-muted
          "
        >
          {formatActivity(
            customer.last_activity_at
          )}
        </AppText>
      </Pressable>

      <Pressable
        onPress={onOpenCustomer}
        accessibilityRole="button"
        accessibilityLabel={`Open ${customer.name} khata`}
        className="
          flex-row
          items-center
          justify-end
          py-4
          pl-3
          pr-4
          active:bg-chip
        "
      >
        <AppText
          numberOfLines={1}
          className="
            font-spline-bold
            text-[18px]
            text-foreground
          "
        >
          Rs {customer.balance.toLocaleString()}
        </AppText>

        <Ionicons
          name="chevron-forward"
          size={18}
          color="#9A9A93"
          style={{ marginLeft: 8 }}
        />
      </Pressable>
    </View>
  );
}

function formatActivity(
  value: string | null
): string {
  if (!value) {
    return 'No activity yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No activity yet';
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const activityDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const days = Math.round(
    (today.getTime() - activityDay.getTime()) /
      86_400_000
  );

  if (days === 0) {
    return `Today, ${formatTime(date)}`;
  }

  if (days === 1) {
    return `Yesterday, ${formatTime(date)}`;
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}