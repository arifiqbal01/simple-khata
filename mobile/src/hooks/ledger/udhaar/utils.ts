
import * as Crypto from 'expo-crypto';

import type { Item } from '@/types/domain';
import type { QuickItem } from '@/services/item/get-quick-items';

import {
  DEFAULT_QUICK_ITEMS,
  QUICK_ITEMS_VISIBLE_LIMIT,
} from '@/config/quick-items';

import type { DraftUdhaarItem } from './types';

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function catalogDefaults(item?: Item | null) {
  return {
    quantity: '1',
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

export function parseLine(
  item: DraftUdhaarItem
): number | null {
  const quantityText = item.quantity.trim();
  const priceText = item.unitPrice.trim();

  if (
    !quantityText ||
    !priceText ||
    !item.unit.trim()
  ) {
    return null;
  }

  const quantity = Number(quantityText);
  const unitPrice = Number(priceText);

  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    !Number.isSafeInteger(unitPrice) ||
    unitPrice < 0
  ) {
    return null;
  }

  const total = quantity * unitPrice;

  return Number.isSafeInteger(total) ? total : null;
}


export function getStarterQuickItems(
  catalog: Item[]
): QuickItem[] {
  return DEFAULT_QUICK_ITEMS
    .slice(0, QUICK_ITEMS_VISIBLE_LIMIT)
    .map((name, index) => {
      const existing = catalog.find(
        (item) =>
          normalizeName(item.name) ===
          normalizeName(name)
      );

      return {
        id: existing?.id ?? null,
        name: existing?.name ?? name,
        score: DEFAULT_QUICK_ITEMS.length - index,
        defaultUnit:
          existing?.default_unit ?? null,
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
