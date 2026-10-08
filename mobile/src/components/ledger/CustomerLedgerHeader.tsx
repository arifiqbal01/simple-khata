
import React from 'react';

import { View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { TransactionFilters } from '@/components/ledger/TransactionFilters';

import {
  AppText,
  Button,
} from '@/components/ui';

import { formatRupees } from '@/utils/ledger/format-rupees';

import type {
  TransactionFilterState,
} from '@/hooks/ledger/useCustomerTransactions';

export interface CustomerLedgerHeaderProps {
  balance: number;

  filter: TransactionFilterState;

  onFilterChange: (
    filter: TransactionFilterState
  ) => void;

  onAddUdhaar: () => void;

  onPayment: () => void;

  onShareWhatsApp: () => void;

  isSharing?: boolean;
}

export function CustomerLedgerHeader({
  balance,
  filter,
  onFilterChange,
  onAddUdhaar,
  onPayment,
  onShareWhatsApp,
  isSharing = false,
}: CustomerLedgerHeaderProps) {
  return (
    <View>
      {/* Outstanding label and balance in one row */}
      <View className="flex-row items-center justify-between pt-5">
        <AppText className="font-spline-semibold text-[13px] uppercase leading-[18px] text-muted">
          Outstanding
        </AppText>

        <View className="flex-row items-baseline">
          <AppText className="mr-1 font-spline-semibold text-[16px] text-muted">
            Rs
          </AppText>

          <AppText
            numberOfLines={1}
            className="font-spline-bold text-[28px] leading-[36px] text-foreground"
          >
            {formatRupees(balance)}
          </AppText>
        </View>
      </View>

      {/* Ledger actions */}
      <View className="mt-5 flex-row gap-3">
        <Button
          label="Add Udhaar"
          onPress={onAddUdhaar}
          className="flex-1"
          left={
            <Ionicons
              name="add"
              size={22}
              color="#FFFFFF"
            />
          }
        />

        <Button
          label="Payment"
          variant="secondary"
          onPress={onPayment}
          className="flex-1"
          left={
            <Ionicons
              name="arrow-down-outline"
              size={20}
              color="#181816"
            />
          }
        />
      </View>

      {/* WhatsApp share action */}
      <View className="mt-3">
        <Button
          label={isSharing ? 'Preparing Summary...' : 'Share on WhatsApp'}
          variant="secondary"
          onPress={onShareWhatsApp}
          disabled={isSharing}
          className="w-full"
          left={
            <Ionicons
              name="logo-whatsapp"
              size={20}
              color="#25D366"
            />
          }
        />
      </View>

      {/* Transactions heading */}
      <View className="mt-9">
        <AppText className="font-spline-semibold text-[19px] text-foreground">
          Transactions
        </AppText>
      </View>

      {/* Recent / Today / Yesterday / Custom */}
      <TransactionFilters
        filter={filter}
        onChange={onFilterChange}
      />
    </View>
  );
}
