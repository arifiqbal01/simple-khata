
import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import * as Crypto from 'expo-crypto';

import type { Item } from '@/types/domain';
import type { QuickItem } from '@/services/item/get-quick-items';
import type { DraftUdhaarItem } from './types';

import {
  catalogDefaults,
  emptyItem,
  findCatalogItem,
  normalizeName,
} from './utils';

function matchesSelectedItem(
  draft: DraftUdhaarItem,
  itemId: string | null,
  name: string
): boolean {
  if (draft.source !== 'selected') {
    return false;
  }

  if (
    itemId !== null &&
    draft.itemId === itemId
  ) {
    return true;
  }

  return (
    normalizeName(draft.name) ===
    normalizeName(name)
  );
}

function resolveCatalogItem(
  availableItems: Item[],
  itemId: string | null,
  name: string
): Item | undefined {
  if (itemId) {
    const byId = availableItems.find(
      (item) => item.id === itemId
    );

    if (byId) {
      return byId;
    }
  }

  return findCatalogItem(
    availableItems,
    name
  );
}

function quickItemDefaults(
  quickItem: QuickItem,
  catalogItem?: Item
) {
  const unit =
    catalogItem?.default_unit ??
    quickItem.defaultUnit ??
    '';

  const sellingPrice =
    catalogItem?.default_selling_price ??
    quickItem.defaultSellingPrice;

  return {
    quantity: '1',
    unit,
    unitPrice:
      sellingPrice == null
        ? ''
        : String(sellingPrice),
  };
}

export function useUdhaarItems(
  availableItems: Item[]
) {
  const [items, setItems] =
    useState<DraftUdhaarItem[]>([]);

  const selectedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.source === 'selected' &&
          item.name.trim().length > 0
      ),
    [items]
  );

  const draftItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.source === 'editor'
      ),
    [items]
  );

  const addItemRow = useCallback(() => {
    setItems((current) => [
      ...current,
      emptyItem(),
    ]);
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      setItems((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );
    },
    []
  );

  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  const changeItemName = useCallback(
    (id: string, name: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                name,
                itemId: null,
                source: 'editor' as const,
                ...catalogDefaults(),
              }
            : item
        )
      );
    },
    []
  );

  const changeItemQuantity = useCallback(
    (id: string, quantity: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity,
              }
            : item
        )
      );
    },
    []
  );

  const changeItemUnit = useCallback(
    (id: string, unit: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                unit,
              }
            : item
        )
      );
    },
    []
  );

  const changeItemUnitPrice = useCallback(
    (id: string, unitPrice: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                unitPrice,
              }
            : item
        )
      );
    },
    []
  );

  const confirmItem = useCallback(
    (id: string) => {
      setItems((current) => {
        const target = current.find(
          (item) => item.id === id
        );

        if (!target) {
          return current;
        }

        const name = target.name.trim();

        if (!name) {
          return current;
        }

        const catalogItem = findCatalogItem(
          availableItems,
          name
        );

        const resolvedName =
          catalogItem?.name ?? name;

        const resolvedId =
          catalogItem?.id ?? null;

        const alreadySelected = current.some(
          (item) =>
            item.id !== id &&
            matchesSelectedItem(
              item,
              resolvedId,
              resolvedName
            )
        );

        if (alreadySelected) {
          return current.filter(
            (item) => item.id !== id
          );
        }

        const defaults =
          catalogDefaults(catalogItem);

        return current.map((item) =>
          item.id === id
            ? {
                ...item,
                name: resolvedName,
                itemId: resolvedId,
                source: 'selected' as const,

                quantity:
                  item.quantity.trim() ||
                  defaults.quantity,

                unit:
                  item.unit.trim() ||
                  defaults.unit,

                unitPrice:
                  item.unitPrice.trim() ||
                  defaults.unitPrice,
              }
            : item
        );
      });
    },
    [availableItems]
  );

  const selectItem = useCallback(
    (draftId: string, item: Item) => {
      setItems((current) => {
        const alreadySelected = current.some(
          (draft) =>
            draft.id !== draftId &&
            matchesSelectedItem(
              draft,
              item.id,
              item.name
            )
        );

        if (alreadySelected) {
          return current.filter(
            (draft) =>
              draft.id !== draftId
          );
        }

        const defaults =
          catalogDefaults(item);

        return current.map((draft) =>
          draft.id === draftId
            ? {
                ...draft,
                itemId: item.id,
                name: item.name,
                source: 'selected' as const,
                ...defaults,
              }
            : draft
        );
      });
    },
    []
  );

  const toggleAvailableItem = useCallback(
    (item: Item) => {
      setItems((current) => {
        const existing = current.find(
          (draft) =>
            matchesSelectedItem(
              draft,
              item.id,
              item.name
            )
        );

        if (existing) {
          return current.filter(
            (draft) =>
              draft.id !== existing.id
          );
        }

        const editor = current.find(
          (draft) =>
            draft.source === 'editor' &&
            normalizeName(draft.name) ===
              normalizeName(item.name)
        );

        const defaults =
          catalogDefaults(item);

        if (editor) {
          return current.map((draft) =>
            draft.id === editor.id
              ? {
                  ...draft,
                  itemId: item.id,
                  name: item.name,
                  source: 'selected' as const,
                  ...defaults,
                }
              : draft
          );
        }

        return [
          ...current,
          {
            id: Crypto.randomUUID(),
            itemId: item.id,
            name: item.name,
            source: 'selected' as const,
            ...defaults,
          },
        ];
      });
    },
    []
  );

  const toggleQuickItem = useCallback(
    (quickItem: QuickItem) => {
      setItems((current) => {
        /*
         * Resolve catalog products by ID first.
         * Fall back to normalized product name.
         */
        const catalogItem =
          resolveCatalogItem(
            availableItems,
            quickItem.id,
            quickItem.name
          );

        const itemId =
          catalogItem?.id ??
          quickItem.id ??
          null;

        const name =
          catalogItem?.name ??
          quickItem.name;

        /*
         * Tapping an already selected Quick Item
         * removes it from the selected list.
         */
        const existing = current.find(
          (draft) =>
            matchesSelectedItem(
              draft,
              itemId,
              name
            )
        );

        if (existing) {
          return current.filter(
            (draft) =>
              draft.id !== existing.id
          );
        }

        /*
         * Prefer catalog defaults.
         * Use Quick Item defaults as fallback.
         */
        const defaults =
          quickItemDefaults(
            quickItem,
            catalogItem
          );

        /*
         * If a matching search editor exists,
         * convert it to a selected item instead
         * of creating a duplicate.
         */
        const editor = current.find(
          (draft) =>
            draft.source === 'editor' &&
            normalizeName(draft.name) ===
              normalizeName(name)
        );

        if (editor) {
          return current.map((draft) =>
            draft.id === editor.id
              ? {
                  ...draft,
                  itemId,
                  name,
                  source: 'selected' as const,
                  ...defaults,
                }
              : draft
          );
        }

        return [
          ...current,
          {
            id: Crypto.randomUUID(),
            itemId,
            name,
            source: 'selected' as const,
            ...defaults,
          },
        ];
      });
    },
    [availableItems]
  );

  return {
    items,
    selectedItems,
    draftItems,

    addItemRow,
    removeItem,
    clearItems,

    changeItemName,
    changeItemQuantity,
    changeItemUnit,
    changeItemUnitPrice,

    confirmItem,
    selectItem,
    toggleAvailableItem,
    toggleQuickItem,
  };
}
