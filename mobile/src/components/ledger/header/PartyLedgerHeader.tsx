
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FinancialSummary } from '@/components/ledger/shared';
import { TransactionFilters } from './TransactionFilters';

import { AppText, Button } from '@/components/ui';

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
  hideSummaryTitle?: boolean;
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
  hideSummaryTitle = false,
}: PartyLedgerHeaderProps) {
  const isSupplier = partyType === 'SUPPLIER';

  const primaryActionLabel = isSupplier
    ? 'Add Supply'
    : 'Add Udhaar';

  return (
    <View>
      {/* Shared financial summary */}
      <View className="pt-5">
        <FinancialSummary
          variant={isSupplier ? 'supplier' : 'customer'}
          title={
            hideSummaryTitle
              ? ''
              : isSupplier
                ? 'SUPPLIER LEDGER'
                : 'CUSTOMER LEDGER'
          }
          balanceLabel="Outstanding Balance"
          balance={balance}
          leftLabel={
            isSupplier
              ? 'Total Supply'
              : 'Total Udhaar'
          }
          leftAmount={moneyOut}
          leftDirection={
            isSupplier ? 'pay' : 'receive'
          }
          rightLabel="Total Payments"
          rightAmount={moneyIn}
          rightDirection={
            isSupplier ? 'receive' : 'pay'
          }
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
