
import {
  useMemo,
  useState,
} from 'react';

import type {
  DraftUdhaarItem,
  UdhaarTotalsState,
} from './types';

import { parseLine } from './utils';

export function useUdhaarTotals(
  selectedItems: DraftUdhaarItem[]
): UdhaarTotalsState {
  const [amount, setAmount] = useState('');

  const manualAmount = useMemo(
    () => Number(amount.trim()),
    [amount]
  );

  const itemizedTotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) =>
          sum + (parseLine(item) ?? 0),
        0
      ),
    [selectedItems]
  );

  const hasSelectedItems =
    selectedItems.length > 0;

  const itemizedValid =
    hasSelectedItems &&
    selectedItems.every(
      (item) => parseLine(item) !== null
    ) &&
    Number.isSafeInteger(itemizedTotal) &&
    itemizedTotal > 0;

  const manualValid =
    amount.trim().length > 0 &&
    Number.isSafeInteger(manualAmount) &&
    manualAmount > 0;

  const effectiveAmount = hasSelectedItems
    ? itemizedTotal
    : manualAmount;

  const validAmount = hasSelectedItems
    ? itemizedValid
    : manualValid;

  return {
    amount,
    setAmount,
    parsedAmount: effectiveAmount,
    itemizedTotal,
    hasSelectedItems,
    validAmount,
    effectiveAmount,
  };
}
