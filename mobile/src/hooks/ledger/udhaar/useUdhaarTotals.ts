
import {
  useMemo,
  useState,
} from 'react';

import type {
  DraftUdhaarItem,
  UdhaarEntryMode,
  UdhaarTotalsState,
} from './types';

import {
  parseLine,
  parseWholeRupees,
} from './utils';

export function useUdhaarTotals(
  selectedItems: DraftUdhaarItem[],
  mode: UdhaarEntryMode = 'amount'
): UdhaarTotalsState {
  // Used only when no items are selected.
  const [amount, setAmount] = useState('');

  const manualAmount = useMemo(
    () => parseWholeRupees(amount),
    [amount]
  );

  const {
    itemizedTotal,
    itemizedValid,
  } = useMemo(() => {
    if (selectedItems.length === 0) {
      return {
        itemizedTotal: 0,
        itemizedValid: false,
      };
    }

    let total = 0;

    for (const item of selectedItems) {
      const lineAmount = parseLine(item, mode);

      if (lineAmount === null) {
        return {
          itemizedTotal: total,
          itemizedValid: false,
        };
      }

      total += lineAmount;

      if (!Number.isSafeInteger(total)) {
        return {
          itemizedTotal: total,
          itemizedValid: false,
        };
      }
    }

    return {
      itemizedTotal: total,
      itemizedValid: total > 0,
    };
  }, [selectedItems, mode]);

  const hasSelectedItems =
    selectedItems.length > 0;

  const manualValid =
    manualAmount !== null &&
    manualAmount > 0;

  const effectiveAmount = hasSelectedItems
    ? itemizedTotal
    : manualAmount ?? 0;

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
