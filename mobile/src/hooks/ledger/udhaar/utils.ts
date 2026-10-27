
import * as Crypto from 'expo-crypto';

import type { Item } from '@/types/domain';
import type { QuickItem } from '@/services/item/get-quick-items';

import {
  DEFAULT_QUICK_ITEMS,
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

import type {
  DraftUdhaarItem,
  UdhaarEntryMode,
} from './types';

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function catalogDefaults(item?: Item | null) {
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

export function parseWholeRupees(
  value: string
): number | null {
  const text = value.trim();

  if (!/^\d+$/.test(text)) {
    return null;
  }

  const amount = Number(text);

  return Number.isSafeInteger(amount) && amount >= 0
    ? amount
    : null;
}

export function parseQuantity(
  value: string
): number | null {
  const text = value.trim();

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    return null;
  }

  const quantity = Number(text);

  return Number.isFinite(quantity) && quantity > 0
    ? quantity
    : null;
}

export function parseUnitPrice(
  value: string
): number | null {
  return parseWholeRupees(value);
}

export function calculateAmount(
  quantityText: string,
  unitPriceText: string
): number | null {
  const quantity = parseQuantity(quantityText);
  const unitPrice = parseUnitPrice(unitPriceText);

  if (quantity === null || unitPrice === null) {
    return null;
  }

  const total = quantity * unitPrice;

  if (
    !Number.isFinite(total) ||
    total < 0 ||
    total > Number.MAX_SAFE_INTEGER
  ) {
    return null;
  }

  // Round the line total once to whole rupees.
  const rounded = Math.round(total);

  return Number.isSafeInteger(rounded)
    ? rounded
    : null;
}

export function calculateQuantity(
  amountText: string,
  unitPriceText: string
): number | null {
  const amount = parseWholeRupees(amountText);
  const unitPrice = parseUnitPrice(unitPriceText);

  if (
    amount === null ||
    unitPrice === null ||
    unitPrice <= 0
  ) {
    return null;
  }

  const quantity = amount / unitPrice;

  return Number.isFinite(quantity) && quantity > 0
    ? quantity
    : null;
}

export function formatCalculatedQuantity(
  quantity: number,
  decimalPlaces = 6
): string {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return '';
  }

  return quantity
    .toFixed(decimalPlaces)
    .replace(/\.?0+$/, '');
}

export function parseLine(
  item: DraftUdhaarItem,
  mode: UdhaarEntryMode = 'quantity'
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

  const total = calculateAmount(
    item.quantity,
    item.unitPrice
  );

  return total !== null && total > 0
    ? total
    : null;
}

export function getStarterQuickItems(
  catalog: Item[]
): QuickItem[] {
  return DEFAULT_QUICK_ITEMS
    .slice(0, QUICK_ITEMS_VISIBLE_LIMIT)
    .map((name, index) => {
      const existing = catalog.find(
        (item) =>
          normalizeName(item.name) === normalizeName(name)
      );

      return {
        id: existing?.id ?? null,
        name: existing?.name ?? name,
        score: DEFAULT_QUICK_ITEMS.length - index,
        defaultUnit: existing?.default_unit ?? null,
        defaultSellingPrice:
          existing?.default_selling_price ?? null,
      };
    });
}

export function findCatalogItem(
  catalog: Item[],
  name: string
): Item | undefined {
  const normalized = normalizeName(name);

  return catalog.find(
    (item) => normalizeName(item.name) === normalized
  );
}
