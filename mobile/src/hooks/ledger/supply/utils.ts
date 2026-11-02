
import * as Crypto from 'expo-crypto';

import type {
  DraftSupplyItem,
  SupplyEntryMode,
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

/**
 * Create an empty supplier item draft.
 *
 * Supplier products are selected from the
 * supplier's configured product associations.
 */
export function emptySupplyItem(): DraftSupplyItem {
  return {
    id: Crypto.randomUUID(),
    itemId: null,
    name: '',
    amount: '',
    quantity: '',
    unit: '',
    unitPrice: '',
  };
}

/**
 * Determine whether a draft has no selected
 * product or entered financial values.
 */
export function isEmptySupplyItem(
  item: DraftSupplyItem
): boolean {
  return (
    item.itemId === null &&
    item.name.trim().length === 0 &&
    item.amount.trim().length === 0 &&
    item.quantity.trim().length === 0 &&
    item.unitPrice.trim().length === 0
  );
}

/**
 * Calculate the authoritative amount for
 * one supplier item.
 *
 * Amount mode:
 *   Use the entered whole-rupee amount.
 *
 * Quantity mode:
 *   Calculate quantity * unit price,
 *   rounded once to whole rupees.
 *
 * Never recalculate an amount-first amount
 * from its approximate quantity.
 */
export function parseSupplyLine(
  item: DraftSupplyItem,
  mode: SupplyEntryMode = 'quantity'
): number | null {
  if (
    !item.itemId ||
    !item.name.trim() ||
    !item.unit.trim()
  ) {
    return null;
  }

  const unitPrice = parseUnitPrice(item.unitPrice);

  if (unitPrice === null) {
    return null;
  }

  if (mode === 'amount') {
    const amount = parseWholeRupees(item.amount);

    return amount !== null && amount > 0
      ? amount
      : null;
  }

  const amount = calculateAmount(
    item.quantity,
    item.unitPrice
  );

  return amount !== null && amount > 0
    ? amount
    : null;
}

/**
 * Derive an approximate quantity from
 * an amount-first supplier item.
 *
 * Returns an empty string if the amount
 * or unit price cannot produce a valid
 * supported quantity.
 */
export function deriveSupplyQuantity(
  amountText: string,
  unitPriceText: string
): string {
  const quantity = calculateQuantity(
    amountText,
    unitPriceText
  );

  return quantity === null
    ? ''
    : formatCalculatedQuantity(quantity);
}

/**
 * Derive the whole-rupee amount for a
 * quantity-first supplier item.
 */
export function deriveSupplyAmount(
  quantityText: string,
  unitPriceText: string
): string {
  const amount = calculateAmount(
    quantityText,
    unitPriceText
  );

  return amount === null
    ? ''
    : String(amount);
}

/**
 * Validate a supplier item before saving.
 *
 * Supplier products must already have
 * a configured item, unit and price.
 *
 * Amount-first may have an approximate
 * quantity, but that quantity must still
 * satisfy the shared precision rules.
 */
export function isValidSupplyItem(
  item: DraftSupplyItem,
  mode: SupplyEntryMode
): boolean {
  if (
    !item.itemId ||
    !item.name.trim() ||
    item.name.trim().length > 150 ||
    !item.unit.trim() ||
    item.unit.trim().length > 30
  ) {
    return false;
  }

  const unitPrice = parseUnitPrice(item.unitPrice);

  if (unitPrice === null) {
    return false;
  }

  const amount = parseSupplyLine(item, mode);

  if (amount === null) {
    return false;
  }

  // The supplier service currently requires
  // quantity for every saved supply item.
  const quantity = parseQuantity(item.quantity);

  if (quantity === null) {
    return false;
  }

  return true;
}
