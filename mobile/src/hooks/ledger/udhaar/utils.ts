
import * as Crypto from 'expo-crypto';

import type { Item } from '@/types/domain';
import type {
  DraftUdhaarItem,
  UdhaarEntryMode,
} from './types';

import {
  parseWholeRupees,
  parseQuantity,
  parseUnitPrice,
  calculateAmount,
  calculateQuantity,
  formatCalculatedQuantity,
} from '@/utils/ledger/item-calculations';

export {
  parseWholeRupees,
  parseQuantity,
  parseUnitPrice,
  calculateAmount,
  calculateQuantity,
  formatCalculatedQuantity,
};

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function findCatalogItem(
  availableItems: Item[],
  name: string
): Item | undefined {
  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    return undefined;
  }

  return availableItems.find(
    (item) => normalizeName(item.name) === normalizedName
  );
}

export function catalogDefaults(item?: Item): Pick<
  DraftUdhaarItem,
  'amount' | 'quantity' | 'unit' | 'unitPrice'
> {
  return {
    amount: '',
    quantity: '',
    unit: item?.default_unit ?? '',
    unitPrice:
      item?.default_selling_price == null
        ? ''
        : String(item.default_selling_price),
  };
}

export function emptyItem(): DraftUdhaarItem {
  return {
    id: Crypto.randomUUID(),
    itemId: null,
    name: '',
    source: 'editor',
    ...catalogDefaults(),
  };
}



/**
 * Resolve the authoritative whole-rupee amount
 * for a customer Udhaar item.
 *
 * Amount mode:
 *   The entered amount is authoritative.
 *   Unit, price and quantity are optional.
 *
 * Quantity mode:
 *   Calculate quantity × unit price and
 *   round once to whole rupees.
 *
 * Never recalculate an amount-first amount
 * from its approximate derived quantity.
 */
export function parseLine(
  item: DraftUdhaarItem,
  mode: UdhaarEntryMode = 'amount'
): number | null {
  if (!item.name.trim()) {
    return null;
  }

  if (mode === 'amount') {
    const amount = parseWholeRupees(item.amount);

    return amount !== null && amount > 0
      ? amount
      : null;
  }

  if (!item.unit.trim()) {
    return null;
  }

  const quantity = parseQuantity(item.quantity);
  const unitPrice = parseUnitPrice(item.unitPrice);

  if (
    quantity === null ||
    unitPrice === null
  ) {
    return null;
  }

  const amount = calculateAmount(
    item.quantity,
    item.unitPrice
  );

  return amount !== null && amount > 0
    ? amount
    : null;
}
