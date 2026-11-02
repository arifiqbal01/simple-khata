
import { useMemo } from 'react';

import type {
  AvailableSupplyItem,
  DraftSupplyItem,
  SupplyEntryMode,
  SupplyTotalsState,
} from './types';

import {
  isEmptySupplyItem,
  isValidSupplyItem,
  parseSupplyLine,
} from './utils';

interface UseSupplyTotalsInput {
  items: DraftSupplyItem[];
  mode: SupplyEntryMode;
  availableItems: AvailableSupplyItem[];
  balance: number;
}

export function useSupplyTotals({
  items,
  mode,
  availableItems,
  balance,
}: UseSupplyTotalsInput): SupplyTotalsState {
  return useMemo(() => {
    const selectedItems = items.filter(
      (item) => !isEmptySupplyItem(item)
    );

    const hasSelectedItems =
      selectedItems.length > 0;

    const validItems =
      hasSelectedItems &&
      selectedItems.every((item) => {
        if (!isValidSupplyItem(item, mode)) {
          return false;
        }

        // The product must still belong to
        // this supplier's configured catalog.
        return availableItems.some(
          (product) =>
            product.item_id === item.itemId &&
            product.item_name === item.name &&
            product.unit === item.unit &&
            String(product.unit_price) ===
              item.unitPrice
        );
      });

    let itemizedTotal = 0;
    let totalsAreSafe = true;

    for (const item of selectedItems) {
      const lineAmount = parseSupplyLine(
        item,
        mode
      );

      if (lineAmount === null) {
        totalsAreSafe = false;
        break;
      }

      const nextTotal =
        itemizedTotal + lineAmount;

      if (!Number.isSafeInteger(nextTotal)) {
        totalsAreSafe = false;
        break;
      }

      itemizedTotal = nextTotal;
    }

    const validAmount =
      validItems &&
      totalsAreSafe &&
      itemizedTotal > 0;

    const totalAmount = validAmount
      ? itemizedTotal
      : 0;

    const projectedBalance =
      validAmount &&
      Number.isSafeInteger(
        balance + totalAmount
      )
        ? balance + totalAmount
        : balance;

    return {
      itemizedTotal,
      hasSelectedItems,
      validItems,
      validAmount,
      totalAmount,
      projectedBalance,
    };
  }, [items, mode, availableItems, balance]);
}
