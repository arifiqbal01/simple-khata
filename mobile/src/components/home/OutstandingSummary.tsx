
import React from 'react';

import { FinancialSummary } from '@/components/ledger/shared';

interface OutstandingSummaryProps {
  toReceive?: number;
  toPay?: number;

  // Legacy props.
  amount?: number;
  moneyOut?: number;
  moneyIn?: number;
}

function safeAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function OutstandingSummary({
  toReceive,
  toPay,
  amount = 0,
  moneyOut = 0,
  moneyIn = 0,
}: OutstandingSummaryProps) {
  const isPartySummary =
    toReceive !== undefined ||
    toPay !== undefined;

  const receivable = Math.max(
    0,
    safeAmount(toReceive ?? 0)
  );

  const payable = Math.max(
    0,
    safeAmount(toPay ?? 0)
  );

  const netBalance = isPartySummary
    ? receivable - payable
    : safeAmount(amount);

  return (
    <FinancialSummary
      variant="home"
      showHideButton
      title="FINANCIAL OVERVIEW"
      balanceLabel={
        isPartySummary
          ? 'Net Balance'
          : 'Total Outstanding'
      }
      balance={netBalance}
      leftLabel={
        isPartySummary
          ? 'To Receive'
          : 'Money Out'
      }
      leftAmount={
        isPartySummary
          ? receivable
          : moneyOut
      }
      leftDirection="receive"
      rightLabel={
        isPartySummary
          ? 'To Pay'
          : 'Money In'
      }
      rightAmount={
        isPartySummary
          ? payable
          : moneyIn
      }
      rightDirection={
        isPartySummary
          ? 'pay'
          : 'receive'
      }
    />
  );
}
