
import { useCallback, useState } from 'react';

import type {
  AvailableSupplyItem,
  DraftSupplyItem,
  SupplyEntryMode,
} from './types';

import {
  emptySupplyItem,
  deriveSupplyAmount,
  deriveSupplyQuantity,
} from './utils';

export interface SupplyItemsState {
  items: DraftSupplyItem[];
  mode: SupplyEntryMode;
  setMode: (mode: SupplyEntryMode) => void;
  addItemRow: () => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  updateItem: (
    id: string,
    changes: Partial<DraftSupplyItem>
  ) => void;
  selectItem: (
    id: string,
    supplierItemId: string
  ) => void;
}

export function useSupplyItems(
  availableItems: AvailableSupplyItem[]
): SupplyItemsState {
  const [items, setItems] = useState<DraftSupplyItem[]>(
    () => [emptySupplyItem()]
  );

  const [mode, setModeState] =
    useState<SupplyEntryMode>('quantity');

  const setMode = useCallback(
    (nextMode: SupplyEntryMode) => {
      setModeState(nextMode);

      setItems((current) =>
        current.map((item) => {
          if (!item.itemId) return item;

          if (nextMode === 'amount') {
            // Preserve the displayed line amount.
            const amount =
              item.amount ||
              deriveSupplyAmount(
                item.quantity,
                item.unitPrice
              );

            return {
              ...item,
              amount,
              quantity: deriveSupplyQuantity(
                amount,
                item.unitPrice
              ),
            };
          }

          // When switching to quantity mode,
          // quantity becomes authoritative.
          return {
            ...item,
            amount: deriveSupplyAmount(
              item.quantity,
              item.unitPrice
            ),
          };
        })
      );
    },
    []
  );

  const addItemRow = useCallback(() => {
    setItems((current) => [
      ...current,
      emptySupplyItem(),
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => {
      const remaining = current.filter(
        (item) => item.id !== id
      );

      return remaining.length > 0
        ? remaining
        : [emptySupplyItem()];
    });
  }, []);

  const clearItems = useCallback(() => {
    setItems([emptySupplyItem()]);
  }, []);

  const updateItem = useCallback(
    (
      id: string,
      changes: Partial<DraftSupplyItem>
    ) => {
      setItems((current) =>
        current.map((item) => {
          if (item.id !== id) return item;

          // Supplier configuration controls
          // product, name, unit and price.
          if (mode === 'amount') {
            if (changes.amount === undefined) {
              return item;
            }

            const amount = changes.amount;

            return {
              ...item,
              amount,
              quantity: deriveSupplyQuantity(
                amount,
                item.unitPrice
              ),
            };
          }

          if (changes.quantity === undefined) {
            return item;
          }

          const quantity = changes.quantity;

          return {
            ...item,
            quantity,
            amount: deriveSupplyAmount(
              quantity,
              item.unitPrice
            ),
          };
        })
      );
    },
    [mode]
  );

  const selectItem = useCallback(
    (id: string, supplierItemId: string) => {
      const selected = availableItems.find(
        (item) => item.id === supplierItemId
      );

      if (!selected) return;

      setItems((current) =>
        current.map((item) => {
          if (item.id !== id) return item;

          return {
            ...item,
            itemId: selected.item_id,
            name: selected.item_name,
            unit: selected.unit,
            unitPrice: String(selected.unit_price),

            // Do not carry an old product's
            // financial values to a new product.
            amount: '',
            quantity: '',
          };
        })
      );
    },
    [availableItems]
  );

  return {
    items,
    mode,
    setMode,
    addItemRow,
    removeItem,
    clearItems,
    updateItem,
    selectItem,
  };
}
