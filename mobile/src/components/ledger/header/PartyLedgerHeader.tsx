
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MoneySummary } from '@/components/ledger/shared';
import { TransactionFilters } from './TransactionFilters';

import { AppText, Button } from '@/components/ui';
import { formatRupees } from '@/utils/ledger/format-rupees';

import type { TransactionFilterState } from './transaction-filter.types';

export type LedgerPartyType = 'CUSTOMER' | 'SUPPLIER';

export interface PartyLedgerHeaderProps {
  partyType: LedgerPartyType;

  balance: number;
  moneyOut: number;
  moneyIn: number;

  filter: TransactionFilterState;

  onFilterChange: (
    filter: TransactionFilterState
  ) => void;

  onAddTransaction: () => void;
  onPayment: () => void;
  onShareWhatsApp?: () => void;

  isSharing?: boolean;
}

export function PartyLedgerHeader({
  partyType,
  balance,
  moneyOut,
  moneyIn,
  filter,
  onFilterChange,
  onAddTransaction,
  onPayment,
  onShareWhatsApp,
  isSharing = false,
}: PartyLedgerHeaderProps) {
  const isSupplier = partyType === 'SUPPLIER';

  const primaryActionLabel = isSupplier
    ? 'Add Supply'
    : 'Add Udhaar';

  return (
    <View>
      {/* Outstanding balance */}
      <View className="flex-row items-center justify-between gap-3 pt-5">
        <AppText
          numberOfLines={1}
          className="shrink-0 font-spline-semibold text-[13px] uppercase leading-[18px] text-muted"
        >
          Outstanding
        </AppText>

        <View className="min-w-0 flex-1 flex-row items-baseline justify-end">
          <AppText className="mr-1 shrink-0 font-spline-semibold text-[16px] text-muted">
            Rs
          </AppText>

          <AppText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            className="min-w-0 shrink font-spline-bold text-[37px] leading-[44px] text-foreground"
          >
            {formatRupees(balance)}
          </AppText>
        </View>
      </View>

      {/* Money summary */}
      <View className="mt-4">
        <MoneySummary
          moneyOut={moneyOut}
          moneyIn={moneyIn}
        />
      </View>

      {/* Ledger actions */}
      <View className="mt-5 flex-row gap-3">
        <Button
          label={primaryActionLabel}
          onPress={onAddTransaction}
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
              name={
                isSupplier
                  ? 'arrow-up-outline'
                  : 'arrow-down-outline'
              }
              size={20}
              color="#181816"
            />
          }
        />
      </View>

      {/* Optional WhatsApp sharing */}
      {onShareWhatsApp ? (
        <View className="mt-3">
          <Button
            label={
              isSharing
                ? 'Preparing Summary...'
                : 'Share on WhatsApp'
            }
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
      ) : null}

      {/* Transactions heading */}
      <View className="mt-9">
        <AppText className="font-spline-semibold text-[19px] text-foreground">
          Transactions
        </AppText>
      </View>

      {/* Transaction date filters */}
      <TransactionFilters
        filter={filter}
        onChange={onFilterChange}
      />
    </View>
  );
}
