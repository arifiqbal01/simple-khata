import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import * as Crypto from 'expo-crypto';

import type { Item } from '@/types/domain';
import type { QuickItem } from '@/services/item/get-quick-items';

import type {
  DraftUdhaarItem,
  UdhaarEntryMode,
} from './types';

import {
  calculateAmount,
  calculateQuantity,
  catalogDefaults,
  emptyItem,
  findCatalogItem,
  formatCalculatedQuantity,
  normalizeName,
  parseQuantity,
  parseWholeRupees,
} from './utils';

function matchesSelectedItem(
  draft: DraftUdhaarItem,
  itemId: string | null,
  name: string
): boolean {
  if (draft.source !== 'selected') {
    return false;
  }

  if (itemId !== null && draft.itemId === itemId) {
    return true;
  }

  return (
    normalizeName(draft.name) === normalizeName(name)
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

  return findCatalogItem(availableItems, name);
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
    amount: '',
    quantity: '',
    unit,
    unitPrice:
      sellingPrice == null
        ? ''
        : String(sellingPrice),
  };
}

/**
 * Recalculate only the dependent field.
 *
 * Amount-first:
 *   amount is authoritative.
 *
 * Quantity-first:
 *   quantity is authoritative.
 *
 * Never use a calculated quantity to overwrite
 * the original amount in amount-first mode.
 */
function recalculateItem(
  item: DraftUdhaarItem,
  mode: UdhaarEntryMode
): DraftUdhaarItem {
  if (mode === 'amount') {
    const quantity = calculateQuantity(
      item.amount,
      item.unitPrice
    );

    return {
      ...item,
      quantity:
        quantity === null
          ? ''
          : formatCalculatedQuantity(quantity),
    };
  }

  const amount = calculateAmount(
    item.quantity,
    item.unitPrice
  );

  return {
    ...item,
    amount:
      amount === null
        ? ''
        : String(amount),
  };
}

/**
 * When switching modes, preserve the current
 * transaction amount wherever possible.
 *
 * An approximate calculated quantity is not
 * used to recalculate an authoritative amount
 * during an amount -> quantity switch.
 */
function convertItemMode(
  item: DraftUdhaarItem,
  previousMode: UdhaarEntryMode,
  nextMode: UdhaarEntryMode
): DraftUdhaarItem {
  if (previousMode === nextMode) {
    return item;
  }

  if (nextMode === 'amount') {
    // Preserve the already calculated rupee amount.
    // Quantity becomes a derived display value.
    return recalculateItem(item, 'amount');
  }

  // Switching to quantity-first:
  // Preserve the existing amount, and use the
  // current calculated quantity as the starting
  // editable value. Do not recalculate amount yet.
  return { ...item };
}

export function useUdhaarItems(
  availableItems: Item[]
) {
  const [items, setItems] =
    useState<DraftUdhaarItem[]>([]);

  const [mode, setModeState] =
    useState<UdhaarEntryMode>('amount');

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
        (item) => item.source === 'editor'
      ),
    [items]
  );

  const setMode = useCallback(
    (nextMode: UdhaarEntryMode) => {
      if (nextMode === mode) {
        return;
      }

      setItems((current) =>
        current.map((item) =>
          convertItemMode(item, mode, nextMode)
        )
      );

      setModeState(nextMode);
    },
    [mode]
  );

  const addItemRow = useCallback((): string => {
    const draft = emptyItem();
    setItems((current) => [...current, draft]);
    return draft.id;
  }, []);

  /** Select a catalog result without requiring a pre-existing editor row. */
  const addCatalogItem = useCallback((item: Item) => {
    setItems((current) => {
      if (current.some((draft) =>
        matchesSelectedItem(draft, item.id, item.name)
      )) {
        return current;
      }

      const existingEditor = current.find((draft) =>
        draft.source === 'editor' &&
        normalizeName(draft.name) === normalizeName(item.name)
      );
      const selected: DraftUdhaarItem = {
        id: existingEditor?.id ?? Crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        source: 'selected',
        ...catalogDefaults(item),
      };
      return existingEditor
        ? current.map((draft) => draft.id === existingEditor.id ? selected : draft)
        : [...current, selected];
    });
  }, []);

  /** Add a new named item as a selected draft; catalog persistence happens on save. */
  const addNewItem = useCallback((details: {
    name: string;
    unit: string;
    defaultSellingPrice: number | null;
  }) => {
    const name = details.name.trim();
    if (!name) return;

    setItems((current) => {
      if (current.some((draft) =>
        matchesSelectedItem(draft, null, name)
      )) return current;

      const catalogItem = findCatalogItem(availableItems, name);
      const existingEditor = current.find((draft) =>
        draft.source === 'editor' &&
        normalizeName(draft.name) === normalizeName(name)
      );
      const selected: DraftUdhaarItem = {
        id: existingEditor?.id ?? Crypto.randomUUID(),
        itemId: catalogItem?.id ?? null,
        name: catalogItem?.name ?? name,
        source: 'selected',
        amount: '',
        quantity: '',
        unit: details.unit.trim() || catalogItem?.default_unit || '',
        unitPrice: details.defaultSellingPrice == null
          ? (catalogItem?.default_selling_price == null
              ? '' : String(catalogItem.default_selling_price))
          : String(details.defaultSellingPrice),
      };
      return existingEditor
        ? current.map((draft) => draft.id === existingEditor.id ? selected : draft)
        : [...current, selected];
    });
  }, [availableItems]);

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

  const changeItemAmount = useCallback(
    (id: string, amount: string) => {
      if (mode !== 'amount') {
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? recalculateItem(
                {
                  ...item,
                  amount,
                },
                'amount'
              )
            : item
        )
      );
    },
    [mode]
  );

  const changeItemQuantity = useCallback(
    (id: string, quantity: string) => {
      if (mode !== 'quantity') {
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? recalculateItem(
                {
                  ...item,
                  quantity,
                },
                'quantity'
              )
            : item
        )
      );
    },
    [mode]
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
            ? recalculateItem(
                {
                  ...item,
                  unitPrice,
                },
                mode
              )
            : item
        )
      );
    },
    [mode]
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

        const selected: DraftUdhaarItem = {
          ...target,
          name: resolvedName,
          itemId: resolvedId,
          source: 'selected',
          unit:
            target.unit.trim() ||
            defaults.unit,
          unitPrice:
            target.unitPrice.trim() ||
            defaults.unitPrice,
        };

        const recalculated =
          recalculateItem(selected, mode);

        return current.map((item) =>
          item.id === id
            ? recalculated
            : item
        );
      });
    },
    [availableItems, mode]
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

        const defaults =
          quickItemDefaults(
            quickItem,
            catalogItem
          );

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

  /**
   * Optional helpers for screen validation.
   * They do not mutate item state.
   */
  const hasValidItemInputs = useMemo(
    () =>
      selectedItems.every((item) => {
        if (mode === 'amount') {
          const amount =
            parseWholeRupees(item.amount);

          return (
            amount !== null &&
            amount > 0
          );
        }

        return (
          parseQuantity(item.quantity) !== null &&
          calculateAmount(
            item.quantity,
            item.unitPrice
          ) !== null &&
          item.unit.trim().length > 0
        );
      }),
    [selectedItems, mode]
  );

  return {
    items,
    selectedItems,
    draftItems,

    mode,
    setMode,

    addItemRow,
    addCatalogItem,
    addNewItem,
    removeItem,
    clearItems,

    changeItemName,
    changeItemAmount,
    changeItemQuantity,
    changeItemUnit,
    changeItemUnitPrice,

    confirmItem,
    selectItem,
    toggleAvailableItem,
    toggleQuickItem,

    hasValidItemInputs,
  };
}